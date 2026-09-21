// ค่าและฟังก์ชันที่ใช้ร่วมกันระหว่างหน้าภาพรวม (/dashboard/all-plans)
// กับหน้ารายการงานของแต่ละกระบวนการ (/dashboard/all-plans/[process])

export interface ProcessSummary {
  process: string
  job_count: number
  total_qty: number
  completed_count: number
  min_due: string
  target_hours: number
  elapsed_hours: number
  overtime_hours: number
  overtime_jobs: number
}

export interface Job {
  _id?: string
  job_code: string
  drawing_name: string
  quantity: number
  status: string
  due_date: string
  processes: { process: string; person: string; time_hours: number }[]
  target_time: string
  elapsed_time: string
  overtime_seconds: number
  is_overtime: boolean
}

export const PAGE_SIZE = 50

export function secondsToHours(secs: number) {
  return Math.round(secs / 3600 * 10) / 10
}

export function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function formatDate(d: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

export function formatDateShort(d: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  catch { return d }
}

export type PlanStatus = 'completed' | 'at-risk' | 'on-track'

export function planStatus(s: ProcessSummary): PlanStatus {
  const pct = s.job_count > 0 ? s.completed_count / s.job_count : 0
  // ให้ overtime มีลำดับก่อนสถานะเสร็จ เพื่อค้นหางานที่เคยผลิตล่าช้าได้
  if (s.overtime_jobs > 0) return 'at-risk'
  if (pct >= 1) return 'completed'
  return 'on-track'
}

export const STATUS_CONFIG = {
  'on-track':  { label: 'ปกติ',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at-risk':   { label: 'ล่าช้า',    cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  completed:   { label: 'เสร็จแล้ว', cls: 'bg-sky-50 text-sky-700 border-sky-200'             },
}

const PALETTE = [
  { ring: '#10b981', bar: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', from: 'from-emerald-50' },
  { ring: '#8b5cf6', bar: 'bg-violet-500',  soft: 'bg-violet-50',  text: 'text-violet-700',  from: 'from-violet-50'  },
  { ring: '#f43f5e', bar: 'bg-rose-500',    soft: 'bg-rose-50',    text: 'text-rose-700',    from: 'from-rose-50'    },
  { ring: '#f59e0b', bar: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-700',   from: 'from-amber-50'   },
  { ring: '#3b82f6', bar: 'bg-blue-500',    soft: 'bg-blue-50',    text: 'text-blue-700',    from: 'from-blue-50'    },
  { ring: '#06b6d4', bar: 'bg-cyan-500',    soft: 'bg-cyan-50',    text: 'text-cyan-700',    from: 'from-cyan-50'    },
  { ring: '#ec4899', bar: 'bg-pink-500',    soft: 'bg-pink-50',    text: 'text-pink-700',    from: 'from-pink-50'    },
  { ring: '#14b8a6', bar: 'bg-teal-500',    soft: 'bg-teal-50',    text: 'text-teal-700',    from: 'from-teal-50'    },
]

// สีผูกกับชื่อกระบวนการ (ไม่ใช่ลำดับในรายการ) เพื่อให้การ์ดกับหน้ารายละเอียดได้สีเดียวกัน
// และสีไม่เปลี่ยนเวลาตัวกรองทำให้ลำดับเปลี่ยน
export function colorFor(processName: string) {
  let hash = 0
  for (const ch of processName.toUpperCase()) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
