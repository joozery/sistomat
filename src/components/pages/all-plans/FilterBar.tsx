import { Department, PlanStatus } from './data'

const depts: { value: Department | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'MAT', label: 'MAT' },
  { value: 'QC',  label: 'QC'  },
  { value: 'CNC', label: 'CNC' },
]

const statuses: { value: PlanStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'ทุกสถานะ'  },
  { value: 'on-track',  label: 'ปกติ'       },
  { value: 'at-risk',   label: 'ล่าช้า'     },
  { value: 'completed', label: 'เสร็จแล้ว'  },
]

interface FilterBarProps {
  dept: Department | 'all'
  status: PlanStatus | 'all'
  onDeptChange: (v: Department | 'all') => void
  onStatusChange: (v: PlanStatus | 'all') => void
  total: number
  filtered: number
}

export function FilterBar({ dept, status, onDeptChange, onStatusChange, total, filtered }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Dept filter */}
        <span className="text-xs font-semibold text-gray-400 mr-1">แผนก</span>
        {depts.map((d) => (
          <button
            key={d.value}
            onClick={() => onDeptChange(d.value as Department | 'all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              dept === d.value
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {d.label}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-gray-200" />

        {/* Status filter */}
        <span className="text-xs font-semibold text-gray-400 mr-1">สถานะ</span>
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value as PlanStatus | 'all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              status === s.value
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className="text-xs text-gray-400 shrink-0">
        แสดง <span className="font-bold text-gray-700">{filtered}</span> / {total} แผนงาน
      </span>
    </div>
  )
}
