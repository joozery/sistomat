'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, Doughnut } from 'react-chartjs-2'
import 'chart.js/auto'
import { Cpu, BarChart3, Loader2 } from 'lucide-react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

interface MonthData {
  month: string
  total_jobs: number
  completed_jobs: number
}

export function DashboardCharts() {
  const [running, setRunning] = useState(0)
  const [idle, setIdle] = useState(0)
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = getToken()
      const h = { Authorization: `Bearer ${token}` }
      try {
        const [rtRes, mRes] = await Promise.all([
          fetch('/api/realtime', { headers: h }),
          fetch(`/api/monthly-summary?year=${new Date().getFullYear()}`, { headers: h }),
        ])
        if (rtRes.ok) {
          const rt = await rtRes.json()
          setRunning(rt.running ?? 0)
          setIdle(rt.idle ?? 0)
        }
        if (mRes.ok) {
          const m = await mRes.json()
          setMonths(m.months ?? [])
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const doughnutData = {
    labels: ['กำลังทำงาน', 'รอดำเนินการ'],
    datasets: [{
      data: [running, idle],
      backgroundColor: ['#7B1A1A', '#e2e8f0'],
      hoverBackgroundColor: ['#5C1212', '#cbd5e1'],
      borderWidth: 0,
    }],
  }

  const barData = {
    labels: months.map((m) => m.month),
    datasets: [
      {
        label: 'งานเสร็จสมบูรณ์',
        data: months.map((m) => m.completed_jobs),
        backgroundColor: '#7B1A1A',
        borderRadius: 6,
      },
      {
        label: 'งานทั้งหมด',
        data: months.map((m) => m.total_jobs),
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
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
      y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
      x: { grid: { display: false } },
    },
  }

  const total = running + idle

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      {/* Doughnut */}
      <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#7B1A1A]" />
            สถานะกระบวนการปัจจุบัน
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-60 flex items-center justify-center relative">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
                },
                cutout: '72%',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-2xl font-black text-gray-800">{total}</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">งานทั้งหมด</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar chart */}
      <Card className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-2 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#7B1A1A]" />
            แผนงานรายเดือน {new Date().getFullYear()}
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-60">
            {months.length > 0
              ? <Bar data={barData} options={barOptions} />
              : <div className="h-full flex items-center justify-center text-sm text-gray-400">ไม่มีข้อมูล</div>
            }
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
