import { Cpu, QrCode, ClipboardCheck, Activity, TrendingUp, CheckCircle2 } from 'lucide-react'

const stats = [
  {
    title: 'เครื่องจักรเดินเครื่องอยู่',
    value: '8/10',
    unit: 'เครื่อง',
    subtext: 'ความพร้อมใช้งาน 80%',
    up: true,
    change: '+2',
    icon: Cpu,
    color: 'text-[#7B1A1A] bg-red-50 border-red-100',
  },
  {
    title: 'แพลนงานผลิตเดือนนี้',
    value: '148',
    unit: 'รายการ',
    subtext: '+18.5% จากเดือนก่อน',
    up: true,
    change: '+18.5%',
    icon: ClipboardCheck,
    color: 'text-purple-700 bg-purple-50 border-purple-100',
  },
  {
    title: 'สแกน QR Code วันนี้',
    value: '320',
    unit: 'ครั้ง',
    subtext: 'ความแม่นยำ 99.2%',
    up: true,
    change: '+12%',
    icon: QrCode,
    color: 'text-blue-700 bg-blue-50 border-blue-100',
  },
  {
    title: 'ประสิทธิภาพรวม (OEE)',
    value: '94.2%',
    unit: '',
    subtext: 'เกินเป้าหมายประจำสัปดาห์',
    up: true,
    change: '+3.1%',
    icon: Activity,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
]

export function StatsCards() {
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
