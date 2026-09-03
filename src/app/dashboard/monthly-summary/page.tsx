import { SummaryStats } from '@/components/pages/monthly-summary/SummaryStats'
import { MonthlyBarChart } from '@/components/pages/monthly-summary/MonthlyBarChart'
import { MonthlyTable } from '@/components/pages/monthly-summary/MonthlyTable'
import { Calendar, Download, BarChart2, Filter } from 'lucide-react'

export default function MonthlySummaryPage() {
  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <BarChart2 className="h-3 w-3" /> MONTHLY REPORT & ANALYTICS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            สรุปผลการดำเนินงานรายเดือน
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            สรุปภาพรวมจำนวนออเดอร์ ยอดการผลิตชิ้นงานผ่าน QC ชั่วโมงการทำงาน และประสิทธิภาพ OEE รวมประจำเดือน
          </p>
        </div>

        {/* Filter & Export Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
            <Calendar className="h-4 w-4 text-[#7B1A1A]" />
            <span>ปี 2568 (ม.ค. - มิ.ย.)</span>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B1A1A] hover:bg-[#5C1212] text-white text-xs font-bold shadow-sm transition-all">
            <Download className="h-4 w-4" />
            ออกรายงานสรุป PDF
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <SummaryStats />

      {/* Bar Chart Comparison */}
      <MonthlyBarChart />

      {/* Detailed Monthly Table */}
      <MonthlyTable />
    </div>
  )
}
