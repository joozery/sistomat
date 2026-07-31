import { Plan, Department, deptConfig } from './data'

interface DepartmentSummaryGridProps {
  plans: Plan[]
}

const deptOrder: Department[] = ['MAT', 'QC', 'CNC']

function MiniArcRing({ value, color }: { value: number; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  )
}

export function DepartmentSummaryGrid({ plans }: DepartmentSummaryGridProps) {
  const grandTotal = plans.reduce((s, p) => s + p.jobs, 0)
  const maxJobs = plans.length > 0 ? Math.max(...plans.map((p) => p.jobs)) : 1

  const aggregated = deptOrder.map((dept) => {
    const items = plans.filter((p) => p.department === dept)
    return {
      department: dept,
      totalJobs: items.reduce((s, p) => s + p.jobs, 0),
      orderCount: items.length,
    }
  }).filter((d) => d.orderCount > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          สรุปงานตามแผนก
        </h2>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
          รวม <span className="font-bold text-gray-800">{grandTotal}</span> งาน ·{' '}
          <span className="font-bold text-gray-800">{plans.length}</span> ใบงาน
        </span>
      </div>

      {/* Dept summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {aggregated.map((dept) => {
          const cfg = deptConfig[dept.department]
          const sharePct = grandTotal > 0 ? Math.round((dept.totalJobs / grandTotal) * 100) : 0
          return (
            <div key={dept.department} className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-white p-5 shadow-sm`}>
              <div className={`absolute inset-x-0 top-0 h-1 ${cfg.bar} rounded-t-2xl`} />
              <div className="flex items-start justify-between">
                <div className="mt-1 flex-1">
                  <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${cfg.softBg} ${cfg.text}`}>
                    {dept.department}
                  </span>
                  <p className="mt-1.5 text-xs text-gray-400">{cfg.label}</p>
                  <p className="mt-3 text-3xl font-bold text-gray-900 leading-none">{dept.totalJobs}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    งาน · <span className="font-semibold text-gray-600">{dept.orderCount} ใบงาน</span>
                  </p>
                </div>
                <div className="relative flex items-center justify-center shrink-0">
                  <MiniArcRing value={sharePct} color={cfg.ring} />
                  <span className={`absolute text-xs font-bold ${cfg.text}`}>{sharePct}%</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-1.5 rounded-full ${cfg.bar}`} style={{ width: `${sharePct}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] text-gray-400">{sharePct}% ของงานทั้งหมด</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Work order breakdown */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-50 px-5 py-3">
          <p className="text-xs font-semibold text-gray-500">รายละเอียดใบงาน</p>
          <p className="text-xs text-gray-400">{plans.length} รายการ</p>
        </div>
        {plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">ไม่มีข้อมูล</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {plans.map((wo, i) => {
              const cfg = deptConfig[wo.department]
              const pct = Math.round((wo.jobs / maxJobs) * 100)
              return (
                <div key={wo.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60 transition-colors">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-gray-300">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${cfg.softBg} ${cfg.text}`}>
                    {wo.department}
                  </span>
                  <span className="hidden sm:block text-xs text-gray-400 w-32 truncate">{wo.label}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full ${cfg.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-bold text-gray-800">{wo.jobs}</span>
                  <span className="w-8 shrink-0 text-right text-[11px] text-gray-400">งาน</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
