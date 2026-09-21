'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2, Clock, AlertCircle, AlertTriangle, LayoutGrid, CalendarDays, TrendingUp, Timer,
  Calendar, X, Loader2, Box,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  type ProcessSummary, STATUS_CONFIG, colorFor, formatDate, getToken, planStatus,
} from './shared'

type StatusFilter = 'all' | 'on-track' | 'at-risk' | 'completed'
const STATUS_FILTERS: StatusFilter[] = ['all', 'on-track', 'at-risk', 'completed']

function CircularProgress({ value, stroke }: { value: number; stroke: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={stroke} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (Math.min(value, 100) / 100) * circ}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xl font-bold text-gray-800">{value}%</span>
    </div>
  )
}

export function AllPlansOverview() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ตัวกรองเก็บใน URL (?status=&from=&to=) เพื่อให้กดย้อนกลับจากหน้ารายละเอียดแล้วตัวกรองยังอยู่
  const rawStatus = searchParams.get('status')
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(rawStatus as StatusFilter) ? (rawStatus as StatusFilter) : 'all'
  const summaryDateFrom = searchParams.get('from') ?? ''
  const summaryDateTo = searchParams.get('to') ?? ''

  const updateFilters = (next: Partial<{ status: StatusFilter; from: string; to: string }>) => {
    const merged = { status: statusFilter, from: summaryDateFrom, to: summaryDateTo, ...next }
    const params = new URLSearchParams()
    if (merged.status !== 'all') params.set('status', merged.status)
    if (merged.from) params.set('from', merged.from)
    if (merged.to) params.set('to', merged.to)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const [summary, setSummary] = useState<ProcessSummary[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    setSummaryLoading(true)
    const params = new URLSearchParams()
    if (summaryDateFrom) params.set('dateFrom', summaryDateFrom)
    if (summaryDateTo) params.set('dateTo', summaryDateTo)
    const qs = params.toString()
    fetch(`/api/jobs/process-summary${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSummary(d) })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [summaryDateFrom, summaryDateTo])

  const filteredSummary = summary.filter((s) => statusFilter === 'all' || planStatus(s) === statusFilter)

  const stats = [
    { label: 'กระบวนการทั้งหมด', value: summary.length,                                              icon: LayoutGrid,   color: 'text-gray-700',    bg: 'bg-gray-100'    },
    { label: 'กำลังดำเนินการ',    value: summary.filter((s) => planStatus(s) === 'on-track').length,  icon: Clock,        color: 'text-blue-700',    bg: 'bg-blue-50'     },
    { label: 'ล่าช้า',             value: summary.filter((s) => planStatus(s) === 'at-risk').length,   icon: AlertCircle,  color: 'text-amber-700',   bg: 'bg-amber-50'    },
    { label: 'เสร็จแล้ว',         value: summary.filter((s) => planStatus(s) === 'completed').length,  icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50'  },
  ]

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Production Planning</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">แผนการผลิต</h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
          {stats.map((s) => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${s.bg}`}>
              <s.icon className={`h-3.5 w-3.5 shrink-0 ${s.color}`} />
              <span className={`text-xs font-bold ${s.color}`}>{summaryLoading ? '…' : s.value}</span>
              <span className="text-xs text-gray-500 truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 mr-1">สถานะ</span>
          {STATUS_FILTERS.map((v) => (
            <button key={v} onClick={() => updateFilters({ status: v })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === v ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {v === 'all' ? 'ทุกสถานะ' : STATUS_CONFIG[v].label}
            </button>
          ))}

          <div className="mx-1 hidden sm:block h-4 w-px bg-gray-200" />

          <span className="text-xs font-semibold text-gray-400 mr-1 basis-full sm:basis-auto">กำหนดส่ง</span>
          <div className="relative shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input type="date" value={summaryDateFrom}
              onChange={(e) => updateFilters({ from: e.target.value })}
              className="pl-8 pr-2 h-8 sm:h-7 rounded-full border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#7B1A1A] transition-all" />
          </div>
          <span className="text-gray-300 text-xs">—</span>
          <div className="relative shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input type="date" value={summaryDateTo}
              onChange={(e) => updateFilters({ to: e.target.value })}
              className="pl-8 pr-2 h-8 sm:h-7 rounded-full border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#7B1A1A] transition-all" />
          </div>
          {(summaryDateFrom || summaryDateTo) && (
            <button onClick={() => updateFilters({ from: '', to: '' })}
              className="flex items-center gap-1 h-7 rounded-full px-2 text-[11px] font-semibold text-gray-500 hover:text-[#7B1A1A] hover:bg-red-50 transition-colors">
              <X className="h-3 w-3" /> ล้าง
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          แสดง <span className="font-bold text-gray-700">{filteredSummary.length}</span> / {summary.length} กระบวนการ
        </span>
      </div>

      {/* Cards */}
      {summaryLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
        </div>
      ) : summary.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400 gap-2">
          <Box className="h-8 w-8 opacity-30" />
          <p className="text-sm">ยังไม่มีข้อมูล — กรุณา Import Excel ก่อน</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">ความคืบหน้าตามกระบวนการ</h2>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {filteredSummary.length} กระบวนการ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredSummary.map((s) => {
              const c = colorFor(s.process)
              const pct = s.job_count > 0 ? Math.round((s.completed_count / s.job_count) * 100) : 0
              const stCfg = STATUS_CONFIG[planStatus(s)]

              return (
                <Link
                  key={s.process}
                  href={`/dashboard/all-plans/${encodeURIComponent(s.process)}`}
                  className={`relative block overflow-hidden rounded-2xl bg-gradient-to-br ${c.from} to-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-left w-full`}
                >
                  {/* Deco circle */}
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10"
                    style={{ backgroundColor: c.ring }} />

                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${c.soft} ${c.text}`}>
                          {s.process}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold text-gray-700">
                          {s.job_count.toLocaleString()} งาน · {s.total_qty.toLocaleString()} ชิ้น
                        </p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold ${stCfg.cls}`}>
                        {stCfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-5">
                      <CircularProgress value={pct} stroke={c.ring} />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>เสร็จแล้ว</span>
                            <span className="font-semibold">{s.completed_count}/{s.job_count}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${c.bar}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {s.min_due && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            <span>กำหนดส่งใกล้สุด {formatDate(s.min_due)}</span>
                          </div>
                        )}
                        {s.target_hours > 0 && (
                          <div className="flex flex-wrap items-center gap-x-1 text-[11px] text-gray-400">
                            <Timer className="h-3 w-3 shrink-0" />
                            <span>ตั้งเวลารวม {s.target_hours.toLocaleString()} ชม.</span>
                            <span className="text-gray-300">·</span>
                            <span>ใช้จริง {s.elapsed_hours.toLocaleString()} ชม.</span>
                          </div>
                        )}
                        {s.overtime_hours > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>เกินเวลา +{s.overtime_hours.toLocaleString()} ชม. ({s.overtime_jobs} งาน)</span>
                          </div>
                        )}
                        <p className="text-[11px] text-[#7B1A1A] font-semibold">คลิกเพื่อดูรายการ →</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
