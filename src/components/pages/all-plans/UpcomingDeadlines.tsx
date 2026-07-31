import { Clock, CalendarX2, CalendarCheck2, CalendarClock } from 'lucide-react'
import { Plan, deptConfig, statusConfig } from './data'

interface UpcomingDeadlinesProps {
  plans: Plan[]
}

function getDaysLeft(dueDate: string): number {
  const today = new Date('2026-07-31')
  const due = new Date(dueDate)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getUrgency(days: number) {
  if (days < 0)  return { label: 'เกินกำหนด',   color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   icon: CalendarX2,    bar: 'bg-rose-500'    }
  if (days <= 2) return { label: 'วิกฤต',        color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: CalendarX2,    bar: 'bg-orange-500'  }
  if (days <= 7) return { label: 'ใกล้ครบกำหนด', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: CalendarClock, bar: 'bg-amber-400'   }
  return           { label: 'ปกติ',             color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CalendarCheck2, bar: 'bg-emerald-400' }
}

export function UpcomingDeadlines({ plans }: UpcomingDeadlinesProps) {
  const sorted = [...plans]
    .filter((p) => p.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const criticalCount = sorted.filter((p) => getDaysLeft(p.dueDate) <= 2).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-50 px-5 py-3.5">
        <Clock className="h-4 w-4 text-blue-500" />
        <p className="text-sm font-semibold text-gray-700">งานใกล้ครบกำหนด</p>
        {criticalCount > 0 && (
          <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">
            {criticalCount} วิกฤต
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">เรียงตามวันส่งงาน</span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <CalendarCheck2 className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">ไม่มีงานค้างอยู่</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sorted.map((plan) => {
            const days = getDaysLeft(plan.dueDate)
            const urgency = getUrgency(days)
            const dept = deptConfig[plan.department]
            const status = statusConfig[plan.status]
            const UrgencyIcon = urgency.icon

            return (
              <div key={plan.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/60`}>
                {/* Urgency icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${urgency.bg}`}>
                  <UrgencyIcon className={`h-4 w-4 ${urgency.color}`} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${dept.softBg} ${dept.text}`}>
                      {plan.department}
                    </span>
                    <p className="truncate text-sm font-medium text-gray-700">{plan.label}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${dept.bar}`}
                        style={{ width: `${plan.percentage}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">{plan.percentage}%</span>
                  </div>
                </div>

                {/* Right: days left + status */}
                <div className="shrink-0 text-right space-y-1">
                  <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${urgency.bg} ${urgency.color} ${urgency.border}`}>
                    {days < 0
                      ? `เกิน ${Math.abs(days)} วัน`
                      : days === 0
                      ? 'ส่งวันนี้'
                      : `${days} วัน`}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {new Date(plan.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
