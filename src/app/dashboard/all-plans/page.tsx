'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, LayoutGrid } from 'lucide-react'
import { plansData, Department, PlanStatus } from '@/components/pages/all-plans/data'
import { FilterBar } from '@/components/pages/all-plans/FilterBar'
import { PlanProgressCards } from '@/components/pages/all-plans/PlanProgressCards'
import { DepartmentSummaryGrid } from '@/components/pages/all-plans/DepartmentSummaryGrid'

export default function AllPlansPage() {
  const [deptFilter, setDeptFilter] = useState<Department | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'all'>('all')

  const filtered = plansData.filter((p) => {
    const deptOk   = deptFilter   === 'all' || p.department === deptFilter
    const statusOk = statusFilter === 'all' || p.status     === statusFilter
    return deptOk && statusOk
  })

  const stats = [
    { label: 'งานทั้งหมด',       value: filtered.length,                                    icon: LayoutGrid,   color: 'text-gray-700',   bg: 'bg-gray-100'   },
    { label: 'กำลังดำเนินการ',   value: filtered.filter((p) => p.status === 'on-track').length,  icon: Clock,        color: 'text-blue-700',   bg: 'bg-blue-50'    },
    { label: 'ล่าช้า',            value: filtered.filter((p) => p.status === 'at-risk').length,   icon: AlertCircle,  color: 'text-amber-700',  bg: 'bg-amber-50'   },
    { label: 'เสร็จแล้ว',        value: filtered.filter((p) => p.status === 'completed').length,  icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Production Planning
          </p>
          <h1 className="text-2xl font-bold text-gray-900">แผนการผลิต</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${s.bg}`}>
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className={`text-xs font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-500 hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <FilterBar
        dept={deptFilter}
        status={statusFilter}
        onDeptChange={setDeptFilter}
        onStatusChange={setStatusFilter}
        total={plansData.length}
        filtered={filtered.length}
      />

      {/* Plan cards */}
      <PlanProgressCards plans={filtered} />

      {/* Dept summary */}
      <DepartmentSummaryGrid plans={filtered} />
    </div>
  )
}
