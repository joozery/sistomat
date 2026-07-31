export type Department = 'MAT' | 'QC' | 'CNC'
export type PlanStatus = 'on-track' | 'at-risk' | 'completed'

export interface Plan {
  id: number
  department: Department
  label: string
  percentage: number
  dueDate: string // YYYY-MM-DD
  status: PlanStatus
  jobs: number
}

export const plansData: Plan[] = [
  { id: 1, department: 'MAT', label: 'วัตถุดิบ ชุด A', percentage: 75, dueDate: '2026-08-02', status: 'on-track',  jobs: 17 },
  { id: 2, department: 'QC',  label: 'ตรวจสอบคุณภาพ', percentage: 50, dueDate: '2026-08-01', status: 'at-risk',   jobs: 18 },
  { id: 3, department: 'CNC', label: 'งานเครื่อง CNC',  percentage: 60, dueDate: '2026-08-05', status: 'on-track',  jobs: 20 },
  { id: 4, department: 'MAT', label: 'วัตถุดิบ ชุด B', percentage: 40, dueDate: '2026-07-31', status: 'at-risk',   jobs: 11 },
  { id: 5, department: 'MAT', label: 'วัตถุดิบ ชุด C', percentage: 17, dueDate: '2026-08-08', status: 'on-track',  jobs: 17 },
  { id: 6, department: 'MAT', label: 'วัตถุดิบ ชุด D', percentage: 80, dueDate: '2026-08-15', status: 'on-track',  jobs: 40 },
  { id: 7, department: 'MAT', label: 'วัตถุดิบ ชุด E', percentage: 90, dueDate: '2026-08-20', status: 'completed', jobs: 30 },
]

export const deptConfig: Record<Department, {
  label: string; bar: string; ring: string; softBg: string; text: string; border: string
}> = {
  MAT: { label: 'วัตถุดิบ',        bar: 'bg-emerald-500', ring: '#10b981', softBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  QC:  { label: 'ควบคุมคุณภาพ',    bar: 'bg-rose-500',    ring: '#f43f5e', softBg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'    },
  CNC: { label: 'เครื่องจักร CNC', bar: 'bg-violet-500',  ring: '#8b5cf6', softBg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-100'  },
}

export const statusConfig: Record<PlanStatus, { label: string; class: string }> = {
  'on-track': { label: 'ปกติ',     class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at-risk':  { label: 'ล่าช้า',   class: 'bg-amber-50   text-amber-700   border-amber-200'   },
  completed:  { label: 'เสร็จแล้ว', class: 'bg-sky-50    text-sky-700     border-sky-200'      },
}
