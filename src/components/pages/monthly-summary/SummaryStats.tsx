import { TrendingUp, TrendingDown, ClipboardCheck, CheckCircle2, Cpu, Clock } from 'lucide-react'

const stats = [
  {
    title: 'ออเดอร์ส่งมอบสะสม',
    value: '348',
    unit: 'รายการ',
    change: '+14.2%',
    up: true,
    subtext: 'เทียบกับเดือนที่แล้ว',
    icon: ClipboardCheck,
    color: 'text-[#c62828] bg-red-50 border-red-100',
  },
  {
    title: 'ชิ้นงานผ่าน QC ทั้งหมด',
    value: '12,850',
    unit: 'ชิ้น',
    change: '+18.0%',
    up: true,
    subtext: 'ผ่านเกณฑ์มาตรฐาน 99.1%',
    icon: CheckCircle2,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  {
    title: 'ชั่วโมงการเดินเครื่องรวม',
    value: '1,420',
    unit: 'ชม.',
    change: '+8.4%',
    up: true,
    subtext: 'เฉลี่ย 47.3 ชม./วัน',
    icon: Clock,
    color: 'text-purple-700 bg-purple-50 border-purple-100',
  },
  {
    title: 'อัตราส่งมอบตรงเวลา',
    value: '97.8%',
    unit: '',
    change: '+2.5%',
    up: true,
    subtext: 'บรรลุ KPI ประจำปี',
    icon: Cpu,
    color: 'text-blue-700 bg-blue-50 border-blue-100',
  },
]

export function SummaryStats() {
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

            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              <TrendingUp className="h-3 w-3" />
              {stat.change}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400">{stat.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl lg:text-3xl font-extrabold text-gray-800 tracking-tight">
                {stat.value}
              </span>
              {stat.unit && <span className="text-xs font-bold text-gray-500">{stat.unit}</span>}
            </div>
            <p className="text-[11px] font-medium text-gray-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {stat.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
