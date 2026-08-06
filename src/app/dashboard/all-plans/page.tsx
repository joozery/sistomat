'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, Clock, AlertCircle, LayoutGrid, CalendarDays, TrendingUp,
  Search, Calendar, X, ExternalLink, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Box,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessSummary {
  process: string
  job_count: number
  total_qty: number
  completed_count: number
  min_due: string
}

interface Job {
  _id?: string
  job_code: string
  drawing_name: string
  quantity: number
  status: string
  due_date: string
  processes: { process: string; person: string; time_hours: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

function formatDate(d: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function formatDateShort(d: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  catch { return d }
}

function isOverdue(due: string) {
  if (!due) return false
  return new Date(due) < new Date(new Date().toDateString())
}

function planStatus(s: ProcessSummary): 'completed' | 'at-risk' | 'on-track' {
  const pct = s.job_count > 0 ? s.completed_count / s.job_count : 0
  if (pct >= 1) return 'completed'
  if (isOverdue(s.min_due)) return 'at-risk'
  return 'on-track'
}

const STATUS_CONFIG = {
  'on-track':  { label: 'ปกติ',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at-risk':   { label: 'ล่าช้า',    cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  completed:   { label: 'เสร็จแล้ว', cls: 'bg-sky-50 text-sky-700 border-sky-200'             },
}

// Color palette (cycles by index)
const PALETTE = [
  { ring: '#10b981', bar: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', from: 'from-emerald-50' },
  { ring: '#8b5cf6', bar: 'bg-violet-500',  soft: 'bg-violet-50',  text: 'text-violet-700',  from: 'from-violet-50'  },
  { ring: '#f43f5e', bar: 'bg-rose-500',    soft: 'bg-rose-50',    text: 'text-rose-700',    from: 'from-rose-50'    },
  { ring: '#f59e0b', bar: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-700',   from: 'from-amber-50'   },
  { ring: '#3b82f6', bar: 'bg-blue-500',    soft: 'bg-blue-50',    text: 'text-blue-700',    from: 'from-blue-50'    },
  { ring: '#06b6d4', bar: 'bg-cyan-500',    soft: 'bg-cyan-50',    text: 'text-cyan-700',    from: 'from-cyan-50'    },
  { ring: '#ec4899', bar: 'bg-pink-500',    soft: 'bg-pink-50',    text: 'text-pink-700',    from: 'from-pink-50'    },
  { ring: '#14b8a6', bar: 'bg-teal-500',    soft: 'bg-teal-50',    text: 'text-teal-700',    from: 'from-teal-50'    },
]
const color = (i: number) => PALETTE[i % PALETTE.length]

const PAGE_SIZE = 50

// ─── Sub-components ───────────────────────────────────────────────────────────

function CircularProgress({ value, stroke }: { value: number; stroke: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center">
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AllPlansPage() {
  const router = useRouter()

  // Overview data
  const [summary, setSummary] = useState<ProcessSummary[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)

  // View: 'cards' | 'jobs'
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  // Filters (for cards view)
  const [statusFilter, setStatusFilter] = useState<'all' | 'on-track' | 'at-risk' | 'completed'>('all')

  // Jobs view state
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [jobsLoading, setJobsLoading] = useState(false)

  // Load summary
  useEffect(() => {
    setSummaryLoading(true)
    fetch('/api/jobs/process-summary', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSummary(d) })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [])

  // Load jobs (when in detail view)
  const loadJobs = useCallback(async (proc: string, q: string, from: string, to: string, pg: number) => {
    setJobsLoading(true)
    try {
      const params = new URLSearchParams({ process: proc, page: String(pg), limit: String(PAGE_SIZE) })
      if (q)    params.set('search', q)
      if (from) params.set('dateFrom', from)
      if (to)   params.set('dateTo', to)
      const res = await fetch(`/api/jobs?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const json = await res.json()
      setJobs(json.jobs ?? [])
      setTotal(json.total ?? 0)
    } catch { /* ignore */ }
    finally { setJobsLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedProcess) loadJobs(selectedProcess, search, dateFrom, dateTo, page)
  }, [selectedProcess, search, dateFrom, dateTo, page, loadJobs])

  // Handle card click
  const openProcess = (proc: string, idx: number) => {
    setSelectedProcess(proc)
    setSelectedIndex(idx)
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setJobs([])
  }

  const goBack = () => {
    setSelectedProcess(null)
    setJobs([])
  }

  // Filtered summary for cards view
  const filteredSummary = summary.filter((s) => {
    if (statusFilter === 'all') return true
    return planStatus(s) === statusFilter
  })

  // Global stats from full summary
  const stats = [
    { label: 'กระบวนการทั้งหมด', value: summary.length,                                              icon: LayoutGrid,   color: 'text-gray-700',    bg: 'bg-gray-100'    },
    { label: 'กำลังดำเนินการ',    value: summary.filter((s) => planStatus(s) === 'on-track').length,  icon: Clock,        color: 'text-blue-700',    bg: 'bg-blue-50'     },
    { label: 'ล่าช้า',             value: summary.filter((s) => planStatus(s) === 'at-risk').length,   icon: AlertCircle,  color: 'text-amber-700',   bg: 'bg-amber-50'    },
    { label: 'เสร็จแล้ว',         value: summary.filter((s) => planStatus(s) === 'completed').length,  icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50'  },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const c = color(selectedIndex)

  // ── Detail view (job list) ──────────────────────────────────────────────────
  if (selectedProcess) {
    return (
      <div className="space-y-6 font-sans">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={goBack}
            className="gap-2 rounded-full border-gray-200 text-gray-700 h-9 px-4 text-xs font-semibold">
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับ
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Production Planning</p>
            <h1 className="text-xl font-bold text-gray-900">
              กระบวนการ: <span className={c.text}>{selectedProcess}</span>
            </h1>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหา JOB หรือชื่อแบบ..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-10 h-9 rounded-full border-gray-200 text-sm" />
          </div>
          <div className="relative shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="pl-9 pr-3 h-9 rounded-full border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#c62828] transition-all" />
          </div>
          <span className="text-gray-300 text-xs shrink-0">—</span>
          <div className="relative shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="pl-9 pr-3 h-9 rounded-full border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#c62828] transition-all" />
          </div>
          {(search || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}
              className="shrink-0 h-9 rounded-full text-gray-500 hover:text-[#c62828] hover:bg-red-50 gap-1.5 text-xs">
              <X className="h-3.5 w-3.5" /> ล้าง
            </Button>
          )}
        </div>

        {/* Job table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <span className="text-sm font-semibold text-gray-600">
              {jobsLoading ? '...' : total.toLocaleString()} รายการ
            </span>
            {jobsLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
          </div>

          {jobsLoading && jobs.length === 0 ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#c62828]" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <Box className="h-8 w-8 opacity-30" />
              <p className="text-sm">ไม่พบรายการงาน</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2fr_3fr_auto_auto_auto_auto] gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/40">
                <span>JOB Code</span><span>ชื่อแบบ (DWG)</span>
                <span className="text-center">จำนวน</span><span>กำหนดส่ง</span><span>สถานะ</span><span></span>
              </div>
              <div className="divide-y divide-gray-50">
                {jobs.map((job, idx) => {
                  const done = job.status === 'ครบ' || job.status === 'รับแล้ว'
                  const late = isOverdue(job.due_date) && !done
                  return (
                    <div key={`${job.job_code}-${idx}`}
                      className="grid grid-cols-[2fr_3fr_auto_auto_auto_auto] gap-4 px-5 py-3 items-center hover:bg-gray-50/60 transition-colors group">
                      <span className="font-mono text-xs font-bold text-gray-800 group-hover:text-[#c62828] transition-colors truncate">
                        {job.job_code}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{job.drawing_name || '-'}</span>
                      <span className="text-xs font-bold text-gray-700 text-center whitespace-nowrap">
                        {job.quantity} <span className="font-normal text-gray-400">ชิ้น</span>
                      </span>
                      <span className={`text-[11px] font-medium whitespace-nowrap ${late ? 'text-red-500' : 'text-gray-500'}`}>
                        {formatDateShort(job.due_date)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                        done ? 'bg-emerald-50 text-emerald-700' : late ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                      }`}>{job.status || '-'}</span>
                      <Button size="sm" variant="ghost"
                        onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                        className="h-7 rounded-full text-[#c62828] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ใบงาน <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-5 py-3.5">
                  <p className="text-xs text-gray-500">
                    <span className="font-bold text-gray-800">{(page - 1) * PAGE_SIZE + 1}</span>–
                    <span className="font-bold text-gray-800">{Math.min(page * PAGE_SIZE, total)}</span>
                    {' '}/ <span className="font-bold text-gray-800">{total.toLocaleString()}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                      className="h-8 w-8 p-0 rounded-full border-gray-200">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                      return (
                        <Button key={p} size="sm"
                          variant={page === p ? 'default' : 'outline'}
                          onClick={() => setPage(p)}
                          className={`h-8 w-8 p-0 rounded-full text-xs ${page === p ? 'bg-[#c62828] hover:bg-[#b71c1c] text-white border-none' : 'border-gray-200'}`}>
                          {p}
                        </Button>
                      )
                    })}
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                      className="h-8 w-8 p-0 rounded-full border-gray-200">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Overview (card) view ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Production Planning</p>
          <h1 className="text-2xl font-bold text-gray-900">แผนการผลิต</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${s.bg}`}>
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className={`text-xs font-bold ${s.color}`}>{summaryLoading ? '…' : s.value}</span>
              <span className="text-xs text-gray-500 hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 mr-1">สถานะ</span>
          {(['all', 'on-track', 'at-risk', 'completed'] as const).map((v) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === v ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {v === 'all' ? 'ทุกสถานะ' : STATUS_CONFIG[v].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          แสดง <span className="font-bold text-gray-700">{filteredSummary.length}</span> / {summary.length} กระบวนการ
        </span>
      </div>

      {/* Cards */}
      {summaryLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#c62828]" />
        </div>
      ) : summary.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400 gap-2">
          <Box className="h-8 w-8 opacity-30" />
          <p className="text-sm">ยังไม่มีข้อมูล — กรุณา Import Excel ก่อน</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">ความคืบหน้าตามกระบวนการ</h2>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {filteredSummary.length} กระบวนการ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSummary.map((s, i) => {
              const globalIdx = summary.indexOf(s)
              const c = color(globalIdx)
              const pct = s.job_count > 0 ? Math.round((s.completed_count / s.job_count) * 100) : 0
              const st = planStatus(s)
              const stCfg = STATUS_CONFIG[st]

              return (
                <button
                  key={s.process}
                  onClick={() => openProcess(s.process, globalIdx)}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.from} to-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-left w-full`}
                >
                  {/* Deco circle */}
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10"
                    style={{ backgroundColor: c.ring }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${c.soft} ${c.text}`}>
                          {s.process}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold text-gray-700">
                          {s.job_count.toLocaleString()} งาน · {s.total_qty.toLocaleString()} ชิ้น
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${stCfg.cls}`}>
                        {stCfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-5">
                      <CircularProgress value={pct} stroke={c.ring} />
                      <div className="flex-1 space-y-2">
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
                            <CalendarDays className="h-3 w-3" />
                            <span>กำหนดส่งใกล้สุด {formatDate(s.min_due)}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-[#c62828] font-semibold">คลิกเพื่อดูรายการ →</p>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
