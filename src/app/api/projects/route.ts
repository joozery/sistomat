import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { getEffectiveElapsedSeconds } from '@/lib/process-time'
import { summarizeProjectProgress, type ProgressJob } from '@/lib/project-progress'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return request.cookies.get('auth_token')?.value ?? null
}

// แปลง target_time ของกระบวนการ (รองรับรูปแบบดิบเช่น "130" = 1:30 เหมือนหน้าใบงาน) → วินาที
function parseTargetSeconds(raw: string | undefined): number {
  const value = (raw ?? '').trim()
  if (!value) return 0
  let hoursText = ''
  let minutesText = ''
  if (value.includes(':')) {
    const [h = '', m = ''] = value.split(':')
    hoursText = h.replace(/\D/g, '')
    minutesText = m.replace(/\D/g, '')
  } else {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) hoursText = digits
    else { hoursText = digits.slice(0, -2); minutesText = digits.slice(-2) }
  }
  const hours = Math.min(99, Number(hoursText) || 0)
  const minutes = Math.min(59, Number(minutesText) || 0)
  return hours * 3600 + minutes * 60
}

function secondsToHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    jwt.verify(token, JWT_SECRET)

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const { searchParams } = new URL(request.url)
    const process  = searchParams.get('process')
    const search   = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo   = searchParams.get('dateTo')
    const pageNum  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit    = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))

    // ── Mode: filter by process name → paginated response for all-plans detail ──
    if (process) {
      const overtimeSettingDoc = await db.collection('settings').findOne({ key: 'overtime_threshold' })
      const defaultGraceMinutes = Number(overtimeSettingDoc?.grace_minutes ?? 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: Record<string, any> = {
        'processes.process': {
          $regex: `^${process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      }
      if (search) {
        filter.$or = [
          { project_id: { $regex: search, $options: 'i' } },
          { dwg_name:   { $regex: search, $options: 'i' } },
        ]
      }
      if (dateFrom || dateTo) {
        // due_date เก็บเป็น BSON Date ในข้อมูลส่วนใหญ่ แต่ข้อมูลเก่าบางส่วนเป็น string —
        // เทียบ string ตรงๆ กับฟิลด์ที่เป็น Date จะไม่ match เลยเพราะคนละ BSON type กัน
        // เลยต้องแปลงเป็น Date ก่อนเทียบเสมอด้วย $convert (onError/onNull กันพังถ้าไม่มีค่า)
        const dueDateAsDate = { $convert: { input: '$due_date', to: 'date', onError: null, onNull: null } }
        const conds: Record<string, unknown>[] = [{ $ne: [dueDateAsDate, null] }]
        if (dateFrom) conds.push({ $gte: [dueDateAsDate, new Date(`${dateFrom}T00:00:00.000Z`)] })
        if (dateTo)   conds.push({ $lte: [dueDateAsDate, new Date(`${dateTo}T23:59:59.999Z`)] })
        filter.$expr = { $and: conds }
      }
      const skip = (pageNum - 1) * limit
      const [docs, total] = await Promise.all([
        db.collection('projects').find(filter).sort({ due_date: 1, project_id: 1 }).skip(skip).limit(limit).toArray(),
        db.collection('projects').countDocuments(filter),
      ])
      const jobs = docs.map((p) => {
        // หา process instance ที่ตรงกับตัวที่กรอง (เผื่อกรณี job เดียวมีกระบวนการซ้ำชื่อกันหลายแถว ใช้ตัวแรกที่เจอ)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proc = (p.processes ?? []).find((pr: any) =>
          (pr.process ?? '').trim().toLowerCase() === process.trim().toLowerCase()
        )
        const targetSecs = parseTargetSeconds(proc?.target_time)
        const elapsedSecs = proc ? getEffectiveElapsedSeconds(proc) : 0
        let overtimeSeconds = 0
        if (proc && targetSecs > 0) {
          const graceMinutes = String(proc.overtime_grace ?? '').trim()
            ? Number(proc.overtime_grace) || 0
            : defaultGraceMinutes
          overtimeSeconds = Math.max(0, elapsedSecs - (targetSecs + graceMinutes * 60))
        }

        return {
          _id: p._id.toString(),
          job_code:     p.project_id ?? '',
          drawing_name: p.dwg_name   ?? '',
          quantity:     p.quantity   ?? 1,
          status:       p.status     ?? '',
          due_date:     typeof p.due_date === 'string' ? p.due_date : (p.due_date ? new Date(p.due_date).toISOString() : ''),
          target_time:  proc?.target_time ? secondsToHMS(targetSecs) : '',
          elapsed_time: proc ? secondsToHMS(elapsedSecs) : '',
          overtime_seconds: overtimeSeconds,
          is_overtime: overtimeSeconds > 0,
        }
      })
      return NextResponse.json({ jobs, total, page: pageNum, limit })
    }

    // ── Default mode: return plain array (backward compatible for process-qrcode) ──
    const projects = await db
      .collection('projects')
      .find({ type: { $ne: 'job' } })
      .sort({ received_date: -1 })
      .toArray()

    // รวมความคืบหน้าจากใบงานลูก (type: 'job') ด้วย query เดียว — level1 ของลูกอาจมี/ไม่มี prefix "J" ต่างจาก project_id
    const idByLevel1 = new Map<string, string>()
    for (const p of projects) {
      const id = String(p.project_id ?? '')
      if (!id) continue
      idByLevel1.set(id, id)
      idByLevel1.set(`J${id}`, id)
    }
    const children = idByLevel1.size === 0 ? [] : await db.collection('projects').find(
      { type: 'job', level1: { $in: Array.from(idByLevel1.keys()) } },
      { projection: { project_id: 1, dwg_name: 1, job_note: 1, level1: 1, status: 1, processes: 1 } }
    ).toArray()
    const jobsByProject = new Map<string, ProgressJob[]>()
    for (const child of children) {
      const id = idByLevel1.get(String(child.level1))
      if (!id) continue
      const list = jobsByProject.get(id)
      if (list) list.push(child as ProgressJob)
      else jobsByProject.set(id, [child as ProgressJob])
    }

    const serialized = projects.map((p) => ({
      ...p,
      _id: p._id.toString(),
      progress: summarizeProjectProgress(jobsByProject.get(String(p.project_id)) ?? [p as ProgressJob]),
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    )
  }
}
