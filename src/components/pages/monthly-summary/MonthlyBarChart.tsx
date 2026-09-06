'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar as ChartBar } from 'react-chartjs-2'
import 'chart.js/auto'
import { BarChart3 } from 'lucide-react'
import type { MonthData } from '@/app/dashboard/monthly-summary/page'

interface Props {
  months: MonthData[]
  year: number
}

export function MonthlyBarChart({ months, year }: Props) {
  const hasData = months.some((m) => m.total_jobs > 0)

  const barData = {
    labels: months.map((m) => m.month),
    datasets: [
      {
        label: 'งานเสร็จสมบูรณ์ (รายการ)',
        data: months.map((m) => m.completed_jobs),
        backgroundColor: '#7B1A1A',
        borderRadius: 8,
      },
      {
        label: 'งานรับทั้งหมด (รายการ)',
        data: months.map((m) => m.total_jobs),
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
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString()} รายการ`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
      x: { grid: { display: false } },
    },
  }

  const completedTotal = months.reduce((s, m) => s + m.completed_jobs, 0)
  const totalTotal = months.reduce((s, m) => s + m.total_jobs, 0)
  const pct = totalTotal > 0 ? Math.round((completedTotal / totalTotal) * 100 * 10) / 10 : 0

  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100 px-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#7B1A1A]" />
            เปรียบเทียบงานรับกับงานเสร็จรายเดือน
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            สถิติผลงานรวม 12 เดือน ปี {year + 543}
          </p>
        </div>

        {hasData && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#7B1A1A] bg-red-50 px-3 py-1 rounded-full border border-red-100">
            อัตราสำเร็จ {pct}%
          </span>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {hasData ? (
          <div className="h-72">
            <ChartBar data={barData} options={barOptions} />
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-sm text-gray-400">
            ไม่มีข้อมูลในปี {year + 543}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
