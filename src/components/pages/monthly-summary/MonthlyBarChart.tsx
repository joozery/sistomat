'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar as ChartBar } from 'react-chartjs-2'
import 'chart.js/auto'
import { BarChart3, TrendingUp } from 'lucide-react'

const barData = {
  labels: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน'],
  datasets: [
    {
      label: 'ชิ้นงานผลิตสำเร็จ (ชิ้น)',
      data: [1800, 1650, 2100, 1950, 2400, 2950],
      backgroundColor: '#c62828',
      borderRadius: 8,
    },
    {
      label: 'เป้าหมายประจำเดือน (ชิ้น)',
      data: [1500, 1500, 2000, 2000, 2200, 2500],
      backgroundColor: '#e2e8f0',
      borderRadius: 8,
    },
  ],
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { font: { family: 'sans-serif', size: 12 } },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
    },
    x: {
      grid: { display: false },
    },
  },
}

export function MonthlyBarChart() {
  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100 px-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#c62828]" />
            เปรียบเทียบยอดการผลิตสำเร็จกับเป้าหมายรายเดือน
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            สถิติผลงานรวม 6 เดือนแรกของปี 2568
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          <TrendingUp className="h-3.5 w-3.5" />
          เกินเป้าหมายเฉลี่ย +12.4%
        </span>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="h-72">
          <ChartBar data={barData} options={barOptions} />
        </div>
      </CardContent>
    </Card>
  )
}
