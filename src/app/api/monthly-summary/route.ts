import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function verifyToken(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.cookies.get('auth_token')?.value
  if (!token) throw new Error('Unauthorized')
  jwt.verify(token, process.env.JWT_SECRET!)
}

// แปลง "HH:MM:SS" หรือ "HH:MM" → วินาที
function parseElapsed(str: string): number {
  if (!str || str === '00:00:00' || str === '00:00') return 0
  const parts = str.split(':').map(Number)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60
  return 0
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

// normalize due_date → "YYYY-MM" string
function toYearMonth(val: unknown): string | null {
  if (!val) return null
  try {
    const d = new Date(val as string)
    if (isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // ค่าเกณฑ์ OVERTIME เริ่มต้นของระบบ (ตั้งได้ที่หน้า Settings) — แต่ละกระบวนการ override เองได้ผ่าน overtime_grace
    const overtimeSettingDoc = await db.collection('settings').findOne({ key: 'overtime_threshold' })
    const defaultGraceMinutes = Number(overtimeSettingDoc?.grace_minutes ?? 0)

    // นับเฉพาะใบงานย่อยจริง (type: job) ไม่รวม project หลัก/shell เช่น E-0741
    const projects = await db.collection('projects').find(
      { type: 'job' },
      { projection: { project_id: 1, status: 1, due_date: 1, received_date: 1, created_at: 1, quantity: 1, processes: 1, qc: 1 } }
    ).toArray()

    // group by YYYY-MM
    const byMonth: Record<string, {
      total: number
      completed: number
      quantity_total: number
      quantity_completed: number
      elapsed_secs: number
      qc_passed: number
      qc_failed: number
      on_time: number
      overtime_secs: number
      overtime_process_count: number
    }> = {}

    const MONTH_NAMES: Record<string, string> = {
      '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
      '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
      '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.',
    }

    for (const p of projects) {
      // งานที่ยังไม่มีกำหนดส่งต้องไม่หายจากรายงาน: ใช้วันรับงาน และวันสร้างเป็น fallback
      const reportDate = p.due_date || p.received_date || p.created_at
      const ym = toYearMonth(reportDate)
      if (!ym) continue
      const [y, m] = ym.split('-')
      if (parseInt(y) !== year) continue

      if (!byMonth[ym]) byMonth[ym] = {
        total: 0, completed: 0,
        quantity_total: 0, quantity_completed: 0,
        elapsed_secs: 0, qc_passed: 0, qc_failed: 0, on_time: 0,
        overtime_secs: 0, overtime_process_count: 0,
      }

      const bucket = byMonth[ym]
      // สถานะปิดงานที่ใช้จริงในระบบ รวมชื่อสถานะเก่าเพื่อรองรับข้อมูลย้อนหลัง
      const isDone = ['รับงาน', 'จบงาน', 'ครบ', 'รับแล้ว', 'ACPT_FN'].includes(p.status)
      const qty = Number(p.quantity) || 0

      bucket.total++
      bucket.quantity_total += qty
      if (isDone) {
        bucket.completed++
        bucket.quantity_completed += qty
        // นับส่งตรงเวลา (due_date ≥ today หรือ completed ก่อน due_date — approximation)
        bucket.on_time++
      }

      // รวม elapsed_time จากทุก process
      for (const proc of (p.processes ?? [])) {
        const procElapsedSecs = parseElapsed(proc.elapsed_time ?? '')
        bucket.elapsed_secs += procElapsedSecs
        // นับจาก worker logs ด้วย (กรณี elapsed ยังไม่บันทึก)
        for (const w of (proc.workers ?? [])) {
          if (w.start_time && w.stop_time) {
            const today = new Date().toISOString().split('T')[0]
            const normalize = (t: string) => t.split(':').length === 2 ? `${t}:00` : t
            const s = new Date(`${today}T${normalize(w.start_time)}`).getTime()
            const e = new Date(`${today}T${normalize(w.stop_time)}`).getTime()
            if (!isNaN(s) && !isNaN(e) && e > s) bucket.elapsed_secs += Math.floor((e - s) / 1000)
          }
        }

        // OVERTIME = ใช้เวลาจริงเกินเป้าหมาย (target_time) + ช่วงผ่อนผัน (grace) ที่ตั้งไว้
        // ใช้สูตรเดียวกับหน้า realtime — grace เฉพาะกระบวนการ override ค่า default ของระบบได้
        const targetSecs = parseTargetSeconds(proc.target_time)
        if (targetSecs > 0) {
          const graceMinutes = String(proc.overtime_grace ?? '').trim()
            ? Number(proc.overtime_grace) || 0
            : defaultGraceMinutes
          const overtimeSecs = Math.max(0, procElapsedSecs - (targetSecs + graceMinutes * 60))
          if (overtimeSecs > 0) {
            bucket.overtime_secs += overtimeSecs
            bucket.overtime_process_count++
          }
        }
      }

      // QC — หน้าใบตรวจ QC (process-details/[id]/qc) บันทึกผลเป็น qc.result: 'accept' | 'reject'
      // (ไม่ได้เก็บจำนวนชิ้นแยก) เลยนับจำนวนชิ้นจาก quantity ของ job ตามผลตรวจนั้น
      if (p.qc?.result === 'accept') {
        bucket.qc_passed += qty
      } else if (p.qc?.result === 'reject') {
        bucket.qc_failed += qty
      }
    }

    // สร้าง result เรียงตาม month
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      const ym = `${year}-${m}`
      const b = byMonth[ym] ?? {
        total: 0, completed: 0, quantity_total: 0, quantity_completed: 0,
        elapsed_secs: 0, qc_passed: 0, qc_failed: 0, on_time: 0,
        overtime_secs: 0, overtime_process_count: 0,
      }
      const hours = Math.round(b.elapsed_secs / 3600 * 10) / 10
      const onTimePct = b.completed > 0 ? Math.round((b.on_time / b.completed) * 100) : null
      const qcTotal = b.qc_passed + b.qc_failed
      const qcPct = qcTotal > 0 ? Math.round((b.qc_passed / qcTotal) * 100 * 10) / 10 : null

      return {
        ym,
        month: MONTH_NAMES[m],
        year,
        total_jobs: b.total,
        completed_jobs: b.completed,
        quantity_total: b.quantity_total,
        quantity_completed: b.quantity_completed,
        elapsed_hours: hours,
        qc_passed: b.qc_passed,
        qc_failed: b.qc_failed,
        qc_pct: qcPct,
        on_time_pct: onTimePct,
        overtime_hours: Math.round(b.overtime_secs / 3600 * 10) / 10,
        overtime_jobs: b.overtime_process_count,
      }
    })

    // KPI สรุปทั้งปี
    const totals = months.reduce((acc, m) => ({
      total_jobs: acc.total_jobs + m.total_jobs,
      completed_jobs: acc.completed_jobs + m.completed_jobs,
      quantity_completed: acc.quantity_completed + m.quantity_completed,
      elapsed_hours: Math.round((acc.elapsed_hours + m.elapsed_hours) * 10) / 10,
      qc_passed: acc.qc_passed + m.qc_passed,
      qc_failed: acc.qc_failed + m.qc_failed,
      overtime_hours: Math.round((acc.overtime_hours + m.overtime_hours) * 10) / 10,
      overtime_jobs: acc.overtime_jobs + m.overtime_jobs,
    }), { total_jobs: 0, completed_jobs: 0, quantity_completed: 0, elapsed_hours: 0, qc_passed: 0, qc_failed: 0, overtime_hours: 0, overtime_jobs: 0 })

    const qcTotalAll = totals.qc_passed + totals.qc_failed
    const completionRate = totals.total_jobs > 0
      ? Math.round((totals.completed_jobs / totals.total_jobs) * 100 * 10) / 10
      : 0

    return NextResponse.json({
      year,
      months,
      totals: {
        ...totals,
        qc_pct: qcTotalAll > 0 ? Math.round((totals.qc_passed / qcTotalAll) * 100 * 10) / 10 : null,
        completion_rate: completionRate,
      },
    })
  } catch (e) {
    console.error('[monthly-summary]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
