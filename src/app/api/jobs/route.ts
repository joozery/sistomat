import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

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
  const m = code.match(/^(J[A-Z]-\d{3,4})(-\d{3})?(-\d{2})?$/)
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
      db.collection('jobs').find(filter).sort({ level1: 1, level2: 1, seq: 1 }).skip(skip).limit(limit).toArray(),
      db.collection('jobs').countDocuments(filter),
    ])

    return NextResponse.json({ jobs, total, page: pageNum, limit })
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
    const { job_code, drawing_name, quantity, due_date, status, processes, file_url, file_name, attachments } = body

    if (!job_code) return NextResponse.json({ message: 'กรุณากรอกเลข Job Code' }, { status: 400 })

    const levels = parseJobCode(job_code.trim())

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // ห้ามซ้ำ
    const existing = await db.collection('jobs').findOne({ job_code: job_code.trim() })
    if (existing) return NextResponse.json({ message: `Job Code "${job_code}" มีอยู่แล้ว` }, { status: 409 })

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
          dwg_name: drawing_name?.trim() || '',
          due_date: due_date ? new Date(due_date) : null,
          status: status || 'กำลังดำเนินการ',
          quantity: Number(quantity) || 1,
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

    return NextResponse.json({ message: 'สร้าง Job สำเร็จ', job_code: job_code.trim() }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/jobs]', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
