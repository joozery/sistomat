import { Badge } from '@/components/ui/badge'
import { CalendarDays, TrendingUp } from 'lucide-react'
import { Plan, deptConfig, statusConfig } from './data'

interface PlanProgressCardsProps {
  plans: Plan[]
}

function CircularProgress({ value, stroke }: { value: number; stroke: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xl font-bold text-gray-800">{value}%</span>
    </div>
  )
}

export function PlanProgressCards({ plans }: PlanProgressCardsProps) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400">
        <p className="text-sm">ไม่พบแผนงานที่ตรงกับตัวกรอง</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          ความคืบหน้าแผนการผลิต
        </h2>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          {plans.length} แผนงาน
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const dept = deptConfig[plan.department]
          const status = statusConfig[plan.status]

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
                plan.department === 'MAT' ? 'from-emerald-50 to-white' :
                plan.department === 'QC'  ? 'from-rose-50 to-white'    :
                                            'from-violet-50 to-white'
              } border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10"
                style={{ backgroundColor: dept.ring }} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${dept.softBg} ${dept.text}`}>
                      {plan.department}
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-gray-700">{plan.label}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-semibold ${status.class}`}>
                    {status.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-5">
                  <CircularProgress value={plan.percentage} stroke={dept.ring} />
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>ความคืบหน้า</span>
                        <span className="font-semibold">{plan.percentage}/100</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${plan.percentage}%`, backgroundColor: dept.ring }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <CalendarDays className="h-3 w-3" />
                      <span>ครบกำหนด {new Date(plan.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <p className="text-[11px] text-gray-400">{plan.jobs} งาน</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
