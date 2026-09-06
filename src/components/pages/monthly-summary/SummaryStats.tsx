import { ClipboardCheck, CheckCircle2, Clock, Target } from 'lucide-react'
import type { Totals } from '@/app/dashboard/monthly-summary/page'

interface Props {
  totals: Totals | null
  year: number
}

export function SummaryStats({ totals: t, year }: Props) {
  const avgPerJob = t && t.completed_jobs > 0
    ? (t.elapsed_hours / t.completed_jobs).toFixed(1)
    : null

  const stats = [
    {
      title: 'ออเดอร์ส่งมอบสะสม',
      value: t ? t.completed_jobs.toLocaleString() : '—',
      unit: 'รายการ',
      subtext: t ? `จากทั้งหมด ${t.total_jobs.toLocaleString()} รายการ` : '',
      icon: ClipboardCheck,
      color: 'text-[#7B1A1A] bg-red-50 border-red-100',
      badge: t && t.total_jobs > 0 ? `${t.completion_rate}%` : null,
      badgeColor: 'text-[#7B1A1A] bg-red-50 border-red-100',
    },
    {
      title: 'ชิ้นงานผ่าน QC ทั้งหมด',
      value: t ? t.qc_passed.toLocaleString() : '—',
      unit: 'ชิ้น',
      subtext: t?.qc_pct != null
        ? `ผ่านเกณฑ์มาตรฐาน ${t.qc_pct}%`
        : 'ยังไม่มีข้อมูล QC',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
      badge: t?.qc_pct != null ? `${t.qc_pct}%` : null,
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'ชั่วโมงการทำงานรวม',
      value: t ? t.elapsed_hours.toLocaleString() : '—',
      unit: 'ชม.',
      subtext: avgPerJob ? `เฉลี่ย ${avgPerJob} ชม./งาน` : '',
      icon: Clock,
      color: 'text-purple-700 bg-purple-50 border-purple-100',
      badge: null,
      badgeColor: '',
    },
    {
      title: 'อัตราการส่งมอบสำเร็จ',
      value: t ? `${t.completion_rate}%` : '—',
      unit: '',
      subtext: `รวมทั้งปี ${year + 543}`,
      icon: Target,
      color: 'text-blue-700 bg-blue-50 border-blue-100',
      badge: null,
      badgeColor: '',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="relative overflow-hidden rounded-xl bg-white p-5 border border-gray-100/90 shadow-sm/50 transition-all hover:border-gray-200"
        >
          <div className="flex items-start justify-between">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            {stat.badge && (
              <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${stat.badgeColor}`}>
                {stat.badge}
              </span>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400">{stat.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl lg:text-3xl font-extrabold text-gray-800 tracking-tight">
                {stat.value}
              </span>
              {stat.unit && (
                <span className="text-xs font-bold text-gray-500">{stat.unit}</span>
              )}
            </div>
            {stat.subtext && (
              <p className="text-[11px] font-medium text-gray-400 mt-1">{stat.subtext}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
