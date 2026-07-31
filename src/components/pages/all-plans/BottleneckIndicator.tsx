import { AlertTriangle, CheckCircle2, Minus } from 'lucide-react'
import { Plan, Department, deptConfig } from './data'

const CAPACITY: Record<Department, number> = { MAT: 3, QC: 2, CNC: 2 }

interface BottleneckIndicatorProps {
  plans: Plan[]
}

export function BottleneckIndicator({ plans }: BottleneckIndicatorProps) {
  const deptOrder: Department[] = ['MAT', 'QC', 'CNC']

  const deptStats = deptOrder.map((dept) => {
    const items = plans.filter((p) => p.department === dept)
    const orders = items.length
    const totalJobs = items.reduce((s, p) => s + p.jobs, 0)
    const avgPct = orders > 0 ? Math.round(items.reduce((s, p) => s + p.percentage, 0) / orders) : 0
    const capacity = CAPACITY[dept]
    const load = Math.round((orders / capacity) * 100)
    return { dept, orders, totalJobs, avgPct, capacity, load }
  })

  const maxLoad = Math.max(...deptStats.map((d) => d.load))

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-50 px-5 py-3.5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-gray-700">วิเคราะห์คอขวด</p>
        <span className="ml-auto text-[11px] text-gray-400">ความจุ (Capacity) ต่อแผนก</span>
      </div>

      <div className="divide-y divide-gray-50">
        {deptStats.map(({ dept, orders, totalJobs, avgPct, capacity, load }) => {
          const cfg = deptConfig[dept]
          const isBottleneck = load === maxLoad && load > 100
          const isHigh = load >= 80
          const loadColor = load > 100 ? 'bg-rose-500' : load >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
          const loadText = load > 100 ? 'text-rose-600' : load >= 80 ? 'text-amber-600' : 'text-emerald-600'
          const loadBg = load > 100 ? 'bg-rose-50' : load >= 80 ? 'bg-amber-50' : 'bg-emerald-50'

          return (
            <div key={dept} className={`px-5 py-4 ${isBottleneck ? 'bg-rose-50/40' : ''}`}>
              <div className="flex items-center gap-4">
                {/* Dept */}
                <div className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${cfg.softBg} ${cfg.text}`}>
                  {dept}
                </div>

                {/* Load bar */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{cfg.label}</span>
                    <span className={`text-xs font-bold ${loadText}`}>
                      {orders}/{capacity} ใบงาน
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${loadColor}`}
                      style={{ width: `${Math.min(load, 100)}%` }}
                    />
                    {load > 100 && (
                      <div className="absolute inset-y-0 right-0 w-1.5 animate-pulse rounded-r-full bg-rose-300" />
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${loadBg} ${loadText}`}>
                    {load}%
                  </span>
                  <span className="text-[10px] text-gray-400">{totalJobs} งาน · เฉลี่ย {avgPct}%</span>
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  {load > 100 ? (
                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                  ) : isHigh ? (
                    <Minus className="h-5 w-5 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                </div>
              </div>

              {isBottleneck && (
                <p className="mt-2 ml-[4.5rem] text-[11px] font-medium text-rose-600">
                  ⚠ แผนกนี้มีงานเกินความจุ — อาจเป็นคอขวดของกระบวนการผลิต
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-gray-50 bg-gray-50/50 px-5 py-2.5">
        {[
          { color: 'bg-emerald-400', label: 'ปกติ (< 80%)' },
          { color: 'bg-amber-400',   label: 'สูง (80–100%)' },
          { color: 'bg-rose-500',    label: 'เกินความจุ (> 100%)' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${l.color}`} />
            <span className="text-[10px] text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
