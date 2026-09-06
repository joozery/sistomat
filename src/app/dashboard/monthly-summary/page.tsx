'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Download, BarChart2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { SummaryStats } from '@/components/pages/monthly-summary/SummaryStats'
import { MonthlyBarChart } from '@/components/pages/monthly-summary/MonthlyBarChart'
import { MonthlyTable } from '@/components/pages/monthly-summary/MonthlyTable'

export interface MonthData {
  ym: string
  month: string
  year: number
  total_jobs: number
  completed_jobs: number
  quantity_total: number
  quantity_completed: number
  elapsed_hours: number
  qc_passed: number
  qc_failed: number
  qc_pct: number | null
  on_time_pct: number | null
}

export interface Totals {
  total_jobs: number
  completed_jobs: number
  quantity_completed: number
  elapsed_hours: number
  qc_passed: number
  qc_failed: number
  qc_pct: number | null
  completion_rate: number
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export default function MonthlySummaryPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [months, setMonths] = useState<MonthData[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (y: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/monthly-summary?year=${y}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setMonths(data.months ?? [])
      setTotals(data.totals ?? null)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(year) }, [year, fetchData])

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <BarChart2 className="h-3 w-3" /> MONTHLY REPORT & ANALYTICS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">สรุปผลการดำเนินงานรายเดือน</h1>
          <p className="mt-1 text-xs text-gray-500">
            สรุปภาพรวมจำนวนออเดอร์ ยอดการผลิต ชั่วโมงการทำงาน และ QC รวมประจำปี
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Year picker */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
            <button onClick={() => setYear((y) => y - 1)}
              className="p-1 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <span className="flex items-center gap-1.5 px-2 text-sm font-bold text-gray-700 min-w-[90px] justify-center">
              <Calendar className="h-4 w-4 text-[#7B1A1A]" />
              ปี {year + 543}
            </span>
            <button onClick={() => setYear((y) => Math.min(currentYear, y + 1))}
              disabled={year >= currentYear}
              className="p-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30">
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B1A1A] hover:bg-[#5C1212] text-white text-xs font-bold shadow-sm transition-all">
            <Download className="h-4 w-4" />
            ออกรายงาน PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
        </div>
      ) : (
        <>
          <SummaryStats totals={totals} year={year} />
          <MonthlyBarChart months={months} year={year} />
          <MonthlyTable months={months} year={year} />
        </>
      )}
    </div>
  )
}
