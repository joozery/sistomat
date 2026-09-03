import { StatsCards } from '@/components/pages/dashboard/StatsCards'
import { DashboardCharts } from '@/components/pages/dashboard/DashboardCharts'
import { JobApplicationSection } from '@/components/pages/dashboard/JobApplicationSection'
import { Cpu, Activity, ArrowRight, QrCode } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner / Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-900 bg-[url('/bg/bg2.png')] bg-cover bg-center p-6 lg:p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-red-200 backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5 text-red-400" />
              SISTOMAT ERP Control Center
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              ภาพรวมระบบบริหารจัดการคลังและการผลิต
            </h1>
            <p className="text-xs lg:text-sm text-gray-300 leading-relaxed">
              ติดตามการทำงานของเครื่องจักร สถิติการสแกน QR Code และยอดการผลิตประจำวันแบบเรียลไทม์
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard/process-qrcode"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#7B1A1A] hover:bg-[#5C1212] text-white text-xs font-bold shadow-lg shadow-red-900/40 transition-all"
            >
              <QrCode className="h-4 w-4" />
              สแกน QR Code งาน
            </Link>
            <Link
              href="/dashboard/all-plans"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold backdrop-blur-sm transition-all"
            >
              ดูแพลนงานทั้งหมด
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Production Analytics & Machine Distribution Charts */}
      <DashboardCharts />

      {/* Live Machine Status & Active Jobs */}
      <JobApplicationSection />
    </div>
  )
}
