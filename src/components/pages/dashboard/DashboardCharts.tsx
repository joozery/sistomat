'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, Doughnut } from 'react-chartjs-2'
import 'chart.js/auto'
import { Cpu, BarChart3, Info } from 'lucide-react'

const machineStatusData = {
  labels: ['กำลังเดินเครื่องผลิต', 'สแตนด์บาย / รอโหลดชิ้นงาน', 'ซ่อมบำรุง / ขัดข้อง'],
  datasets: [
    {
      data: [8, 1, 1],
      backgroundColor: ['#c62828', '#f59e0b', '#9ca3af'],
      hoverBackgroundColor: ['#b71c1c', '#d97706', '#6b7280'],
      borderWidth: 0,
    },
  ],
}

const productionOutputData = {
  labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
  datasets: [
    {
      label: 'ผ่านการตรวจสอบ QC (ชิ้น)',
      data: [140, 210, 280, 310, 290, 190, 120],
      backgroundColor: '#c62828',
      borderRadius: 8,
    },
    {
      label: 'อยู่ระหว่างดำเนินการ (ชิ้น)',
      data: [30, 45, 50, 60, 40, 30, 15],
      backgroundColor: '#f1f5f9',
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

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      {/* Machine Status Distribution */}
      <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#c62828]" />
            สถานะเครื่องจักรรายวัน
          </CardTitle>
          <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-60 flex items-center justify-center relative">
            <Doughnut
              data={machineStatusData}
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
              <span className="text-2xl font-black text-gray-800">10</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">เครื่องทั้งหมด</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Output Chart */}
      <Card className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-2 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#c62828]" />
            ยอดการผลิตสำเร็จเทียบสัปดาห์นี้
          </CardTitle>
          <span className="text-xs font-semibold text-[#c62828] bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            ยอดรวม: 1,540 ชิ้น
          </span>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-60">
            <Bar data={productionOutputData} options={barOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
