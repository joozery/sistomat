import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { getEffectiveElapsedSeconds } from '@/lib/process-time'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
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

interface ProcessBucket {
  job_count: number
  total_qty: number
  completed_count: number
  min_due: string | Date | null
  target_secs: number
  elapsed_secs: number
  overtime_secs: number
  overtime_jobs: number
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // ค่าเกณฑ์ OVERTIME เริ่มต้นของระบบ (ตั้งได้ที่หน้า Settings) — แต่ละกระบวนการ override เองได้ผ่าน overtime_grace
    const overtimeSettingDoc = await db.collection('settings').findOne({ key: 'overtime_threshold' })
    const defaultGraceMinutes = Number(overtimeSettingDoc?.grace_minutes ?? 0)

    // due_date ในข้อมูลจริงบางส่วนเก็บเป็น BSON Date บางส่วนเก็บเป็น string (ข้อมูลเก่า) —
    // เทียบ string ธรรมดากับฟิลด์ที่เป็น Date ตรงๆ จะไม่ match อะไรเลยเพราะ BSON คนละ type กัน
    // เลยต้องแปลงให้เป็น Date ก่อนเทียบเสมอด้วย $expr + $convert (onError/onNull กันพังถ้าไม่มีค่า)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { type: 'job' }
    if (dateFrom || dateTo) {
      const dueDateAsDate = { $convert: { input: '$due_date', to: 'date', onError: null, onNull: null } }
      const conds: Record<string, unknown>[] = [{ $ne: [dueDateAsDate, null] }]
      if (dateFrom) conds.push({ $gte: [dueDateAsDate, new Date(`${dateFrom}T00:00:00.000Z`)] })
      if (dateTo) conds.push({ $lte: [dueDateAsDate, new Date(`${dateTo}T23:59:59.999Z`)] })
      filter.$expr = { $and: conds }
    }

    const projects = await db.collection('projects').find(
      filter,
      { projection: { due_date: 1, quantity: 1, processes: 1 } }
    ).toArray()

    const byProcess: Record<string, ProcessBucket> = {}

    for (const p of projects) {
      const qty = Number(p.quantity) || 1
      for (const proc of (p.processes ?? [])) {
        const name = (proc.process ?? '').trim()
        if (!name) continue

        if (!byProcess[name]) byProcess[name] = {
          job_count: 0, total_qty: 0, completed_count: 0, min_due: null,
          target_secs: 0, elapsed_secs: 0, overtime_secs: 0, overtime_jobs: 0,
        }
        const bucket = byProcess[name]

        bucket.job_count++
        bucket.total_qty += qty
        if (proc.next_confirmed_at) bucket.completed_count++
        if (p.due_date && (!bucket.min_due || new Date(p.due_date) < new Date(bucket.min_due))) {
          bucket.min_due = p.due_date
        }

        const targetSecs = parseTargetSeconds(proc.target_time)
        const elapsedSecs = getEffectiveElapsedSeconds(proc)
        bucket.target_secs += targetSecs
        bucket.elapsed_secs += elapsedSecs

        if (targetSecs > 0) {
          const graceMinutes = String(proc.overtime_grace ?? '').trim()
            ? Number(proc.overtime_grace) || 0
            : defaultGraceMinutes
          const overtimeSecs = Math.max(0, elapsedSecs - (targetSecs + graceMinutes * 60))
          if (overtimeSecs > 0) {
            bucket.overtime_secs += overtimeSecs
            bucket.overtime_jobs++
          }
        }
      }
    }

    const result = Object.entries(byProcess)
      .map(([name, b]) => ({
        process: name,
        job_count: b.job_count,
        total_qty: b.total_qty,
        completed_count: b.completed_count,
        min_due: b.min_due,
        target_hours: Math.round(b.target_secs / 3600 * 10) / 10,
        elapsed_hours: Math.round(b.elapsed_secs / 3600 * 10) / 10,
        overtime_hours: Math.round(b.overtime_secs / 3600 * 10) / 10,
        overtime_jobs: b.overtime_jobs,
      }))
      .sort((a, b) => b.job_count - a.job_count)

    return NextResponse.json(result)
  } catch (e) {
    console.error('[process-summary]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
