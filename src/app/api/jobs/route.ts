import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'
import { createNotification } from '@/lib/notify'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

interface JwtPayload { id: string; username: string; role: string }

function verifyToken(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  jwt.verify(token, process.env.JWT_SECRET!)
}

function decodeToken(req: NextRequest): JwtPayload | null {
  const token = getToken(req)
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload } catch { return null }
}

// Parse job_code → level1 / level2 / level3 (falls back to a flat code when it
// doesn't match the JX-NNNN-NNN convention, since real job codes vary a lot)
function parseJobCode(code: string) {
  const m = code.match(/^([A-Z]+-\d{3,4})(-\d{3})?(-\d{2,3})?$/)
  if (m) {
    return {
      level1: m[1],
      level2: m[2] ? `${m[1]}${m[2]}` : null,
      level3: m[3] ? `${m[1]}${m[2]}${m[3]}` : null,
    }
  }
  return { level1: code, level2: null, level3: null }
}

// ─── GET ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const { searchParams } = new URL(req.url)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {}

    const level1   = searchParams.get('level1')
    const level2   = searchParams.get('level2')
    const process  = searchParams.get('process')
    const search   = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo   = searchParams.get('dateTo')
    const pageNum  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit    = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))

    if (level1) filter.level1 = level1
    if (level2) filter.level2 = level2
    if (process) {
      filter['processes.process'] = { $regex: `^${process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }
    if (search) {
      filter.$or = [
        { job_code: { $regex: search, $options: 'i' } },
        { drawing_name: { $regex: search, $options: 'i' } },
      ]
    }
    if (dateFrom || dateTo) {
      filter.due_date = {}
      if (dateFrom) filter.due_date.$gte = dateFrom
      if (dateTo)   filter.due_date.$lte = dateTo
    }

    const skip = (pageNum - 1) * limit
    const [jobs, total] = await Promise.all([
      // sort by job_code (not the unused "seq" field) so BU suffixes like -01..-12 always list in order
      db.collection('jobs').find(filter).sort({ level1: 1, level2: 1, job_code: 1 }).skip(skip).limit(limit).toArray(),
      db.collection('jobs').countDocuments(filter),
    ])

    // Enrich with current process info from projects collection
    const jobCodes = jobs.map((j) => j.job_code as string)
    const projectDocs = await db
      .collection('projects')
      .find({ project_id: { $in: jobCodes } }, { projection: { project_id: 1, processes: 1, received_date: 1, is_printed: 1, printed_at: 1 } })
      .toArray()

    type ProjectProcess = {
      process: string
      on_hold?: boolean
      next_confirmed_at?: string | Date | null
      workers?: Array<{ worker_id: string; start_time: string; stop_time: string }>
    }
    type ProjectDocItem = {
      project_id: string
      processes?: ProjectProcess[]
      received_date?: string | Date | null
      is_printed?: boolean
      printed_at?: string | Date | null
    }
    const projectMap = new Map(projectDocs.map((p) => [p.project_id as string, p as unknown as ProjectDocItem]))

    const enrichedJobs = jobs.map((job) => {
      const proj = projectMap.get(job.job_code as string)
      const receivedDate = job.received_date || (proj?.received_date ? (proj.received_date instanceof Date ? proj.received_date.toISOString().slice(0, 10) : String(proj.received_date)) : '')
      const processes = (proj?.processes && proj.processes.length > 0) ? proj.processes : (job.processes ?? [])
      const hasValidProcess = Array.isArray(processes) && processes.some((p: any) => p && typeof p.process === 'string' && p.process.trim().length > 0)
      const isPrinted = Boolean(proj?.is_printed || job.is_printed)
      const printedAt = proj?.printed_at || job.printed_at || null

      if (!hasValidProcess) {
        return {
          ...job,
          processes: Array.isArray(processes) ? processes : [],
          has_no_process: true,
          is_printed: isPrinted,
          printed_at: printedAt,
          received_date: receivedDate,
          current_process_name: null,
          current_process_active: false,
          on_hold: false,
        }
      }

      const currentIdx = processes.findIndex((p: any) => !p.next_confirmed_at)
      if (currentIdx === -1) {
        // All processes confirmed — waiting for final barcode
        return { ...job, processes, has_no_process: false, is_printed: isPrinted, printed_at: printedAt, received_date: receivedDate, current_process_name: null, current_process_active: false, on_hold: false }
      }

      const cur = processes[currentIdx]
      const isActive = cur.workers?.some((w: any) => w.worker_id && w.start_time && !w.stop_time) ?? false

      const onHold = processes.some((process: any) => process.on_hold && !process.next_confirmed_at)
      return { ...job, processes, has_no_process: false, is_printed: isPrinted, printed_at: printedAt, received_date: receivedDate, current_process_name: cur.process, current_process_active: isActive, on_hold: onHold }
    })

    return NextResponse.json({ jobs: enrichedJobs, total, page: pageNum, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── POST ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { job_code, job_note, drawing_name, quantity, received_date, due_date, status, processes, file_url, file_name, attachments } = body

    if (!job_code) return NextResponse.json({ message: 'กรุณากรอกเลข Job Code' }, { status: 400 })

    const levels = parseJobCode(job_code.trim())

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // ห้ามซ้ำ
    const existing = await db.collection('jobs').findOne({ job_code: job_code.trim() })
    if (existing) return NextResponse.json({ message: `Job Code "${job_code}" มีอยู่แล้ว` }, { status: 409 })

    if (levels.level2) {
      const closedGroup = await db.collection('jobs').findOne({
        level2: levels.level2,
        sale_closed_at: { $exists: true, $ne: null },
      })
      if (closedGroup) {
        return NextResponse.json(
          { message: `กลุ่ม ${levels.level2} ปิดการขายแล้ว กรุณาใช้เลขกลุ่มใหม่` },
          { status: 409 }
        )
      }
    }

    // สร้าง process rows
    const processRows = (processes ?? []).filter((p: { process: string }) => p.process?.trim()).map((p: {
      process: string; person?: string; target_time?: string
    }, idx: number) => ({
      id: idx + 1,
      process: p.process.trim(),
      target_time: p.target_time || '00:00',
      skill: '0',
      workers: [
        { worker_id: p.person || '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
      ],
      elapsed_time: '00:00:00',
      remark: '',
    }))

    const newJob = {
      job_code: job_code.trim(),
      job_note: typeof job_note === 'string' ? job_note.trim() : '',
      level1: levels.level1,
      level2: levels.level2,
      level3: levels.level3,
      drawing_name: drawing_name?.trim() || '',
      quantity: Number(quantity) || 1,
      completed: 0,
      remaining: Number(quantity) || 1,
      status: status || 'กำลังดำเนินการ',
      processes: processRows,
      coating: body.coating || '',
      outsource_process: body.outsource_process || '',
      due_date: due_date || '',
      received_date: received_date || '',
      sheet_name: 'manual',
      file_url: file_url || null,
      file_name: file_name || null,
      attachments: Array.isArray(attachments) && attachments.length > 1 ? attachments : null,
      created_at: new Date(),
    }

    await db.collection('jobs').insertOne(newJob)

    // Upsert ลง projects collection (type: job) เพื่อให้ process-details หาได้
    await db.collection('projects').updateOne(
      { project_id: job_code.trim() },
      {
        $setOnInsert: { processes: processRows },
        $set: {
          project_id: job_code.trim(),
          job_note: typeof job_note === 'string' ? job_note.trim() : '',
          dwg_name: drawing_name?.trim() || '',
          received_date: received_date ? new Date(received_date) : null,
          due_date: due_date ? new Date(due_date) : null,
          status: status || 'กำลังดำเนินการ',
          quantity: Number(quantity) || 1,
          level1: levels.level1,
          level2: levels.level2,
          type: 'job',
          file_url: file_url || null,
          file_name: file_name || null,
          attachments: Array.isArray(attachments) && attachments.length > 1 ? attachments : null,
          created_at: new Date(),
        },
      },
      { upsert: true }
    )

    // Log activity (fire-and-forget)
    const actor = decodeToken(req)
    if (actor) {
      db.collection('activity_logs').insertOne({
        username: actor.username,
        role: actor.role,
        action: 'create_job',
        target: job_code.trim(),
        detail: `${drawing_name?.trim() || ''} | qty: ${Number(quantity) || 1}`,
        created_at: new Date(),
      }).catch(() => {})
    }

    // Notify superadmin if subjob has no process
    const hasValidProcess = processRows.some((p: any) => p && typeof p.process === 'string' && p.process.trim().length > 0)
    if (!hasValidProcess) {
      createNotification(db, {
        type: 'info',
        category: 'subjob',
        title: `มีจ๊อบย่อยรอเพิ่มขั้นตอน — ${job_code.trim()}`,
        description: `จ๊อบ ${job_code.trim()}${drawing_name?.trim() ? ` (${drawing_name.trim()})` : ''} ยังไม่มีขั้นตอนกระบวนการผลิต`,
        link: `/dashboard/process-details/${encodeURIComponent(job_code.trim())}`,
      }).catch(() => {})
    }

    return NextResponse.json({ message: 'สร้าง Job สำเร็จ', job_code: job_code.trim() }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/jobs]', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
