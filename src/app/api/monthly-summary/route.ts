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

    // ดึง projects ทั้งหมดที่มี due_date ในปีนั้น (ทุก status)
    const projects = await db.collection('projects').find(
      { due_date: { $exists: true, $ne: null } },
      { projection: { project_id: 1, status: 1, due_date: 1, quantity: 1, processes: 1, qc: 1 } }
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
    }> = {}

    const MONTH_NAMES: Record<string, string> = {
      '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
      '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
      '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.',
    }

    for (const p of projects) {
      const ym = toYearMonth(p.due_date)
      if (!ym) continue
      const [y, m] = ym.split('-')
      if (parseInt(y) !== year) continue

      if (!byMonth[ym]) byMonth[ym] = {
        total: 0, completed: 0,
        quantity_total: 0, quantity_completed: 0,
        elapsed_secs: 0, qc_passed: 0, qc_failed: 0, on_time: 0,
      }

      const bucket = byMonth[ym]
      const isDone = p.status === 'ครบ' || p.status === 'รับแล้ว'
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
        bucket.elapsed_secs += parseElapsed(proc.elapsed_time ?? '')
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
      }

      // QC
      if (p.qc) {
        const passed = Number(p.qc.passed ?? p.qc.pass ?? p.qc.qty_pass ?? 0)
        const failed = Number(p.qc.failed ?? p.qc.fail ?? p.qc.qty_fail ?? 0)
        bucket.qc_passed += passed
        bucket.qc_failed += failed
      }
    }

    // สร้าง result เรียงตาม month
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      const ym = `${year}-${m}`
      const b = byMonth[ym] ?? {
        total: 0, completed: 0, quantity_total: 0, quantity_completed: 0,
        elapsed_secs: 0, qc_passed: 0, qc_failed: 0, on_time: 0,
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
    }), { total_jobs: 0, completed_jobs: 0, quantity_completed: 0, elapsed_hours: 0, qc_passed: 0, qc_failed: 0 })

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
