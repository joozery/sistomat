'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Search, Calendar, X, ExternalLink, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Box,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type Job, PAGE_SIZE, colorFor, formatDateShort, getToken, secondsToHours,
} from './shared'

export function ProcessJobsPage({ processName }: { processName: string }) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [jobsLoading, setJobsLoading] = useState(true)

  // queries projects collection for accuracy
  const loadJobs = useCallback(async (proc: string, q: string, from: string, to: string, pg: number) => {
    setJobsLoading(true)
    try {
      const params = new URLSearchParams({ process: proc, page: String(pg), limit: String(PAGE_SIZE) })
      if (q)    params.set('search', q)
      if (from) params.set('dateFrom', from)
      if (to)   params.set('dateTo', to)
      const res = await fetch(`/api/projects?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const json = await res.json()
      setJobs(json.jobs ?? [])
      setTotal(json.total ?? 0)
    } catch { /* ignore */ }
    finally { setJobsLoading(false) }
  }, [])

  useEffect(() => {
    loadJobs(processName, search, dateFrom, dateTo, page)
  }, [processName, search, dateFrom, dateTo, page, loadJobs])

  const goBack = () => {
    // ย้อนกลับไปหน้าภาพรวมพร้อมตัวกรองเดิม (อยู่ใน URL) ถ้าเข้ามาตรง ๆ ไม่มีประวัติให้กลับ ก็ไปหน้าภาพรวมเลย
    if (window.history.length > 1) router.back()
    else router.push('/dashboard/all-plans')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const c = colorFor(processName)

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={goBack}
          className="gap-2 rounded-full border-gray-200 text-gray-700 h-9 px-4 text-xs font-semibold shrink-0">
          <ArrowLeft className="h-4 w-4" />
          ย้อนกลับ
        </Button>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Production Planning</p>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
            กระบวนการ: <span className={c.text}>{processName}</span>
          </h1>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหา JOB หรือชื่อแบบ..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-10 h-9 rounded-full border-gray-200 text-sm" />
        </div>
        <div className="flex items-center gap-2 min-w-0 sm:contents">
          <div className="relative flex-1 min-w-0 sm:flex-none sm:shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-full min-w-0 pl-9 pr-2 h-9 rounded-full border border-gray-200 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7B1A1A] transition-all" />
          </div>
          <span className="text-gray-300 text-xs shrink-0">—</span>
          <div className="relative flex-1 min-w-0 sm:flex-none sm:shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-full min-w-0 pl-9 pr-2 h-9 rounded-full border border-gray-200 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7B1A1A] transition-all" />
          </div>
        </div>
        {(search || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="shrink-0 h-9 rounded-full text-gray-500 hover:text-[#7B1A1A] hover:bg-red-50 gap-1.5 text-xs">
            <X className="h-3.5 w-3.5" /> ล้าง
          </Button>
        )}
      </div>

      {/* Job list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <span className="text-sm font-semibold text-gray-600">
            {jobsLoading ? '...' : total.toLocaleString()} รายการ
          </span>
          {jobsLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
        </div>

        {jobsLoading && jobs.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#7B1A1A]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <Box className="h-8 w-8 opacity-30" />
            <p className="text-sm">ไม่พบรายการงาน</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[2fr_3fr_auto_auto_auto_auto_auto] gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/40">
              <span>JOB Code</span><span>ชื่อแบบ (DWG)</span>
              <span className="text-center">จำนวน</span><span>เวลา (ตั้ง/ใช้จริง)</span><span>กำหนดส่ง</span><span>สถานะ</span><span></span>
            </div>
            <div className="divide-y divide-gray-50">
              {jobs.map((job, idx) => {
                const done = job.status === 'ครบ' || job.status === 'รับแล้ว'
                // สถานะล่าช้าอิง overtime โดยไม่อิงวันที่กำหนดส่ง
                const late = job.is_overtime
                // มือถือ: flex-wrap เรียงด้วย order (บรรทัด 1 รหัส+สถานะ, 2 ชื่อแบบ, 3 รายละเอียด+ปุ่ม) / md ขึ้นไป: grid 7 คอลัมน์
                return (
                  <div key={`${job.job_code}-${idx}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 md:grid md:grid-cols-[2fr_3fr_auto_auto_auto_auto_auto] md:gap-4 md:px-5 hover:bg-gray-50/60 transition-colors group">
                    <span className="order-1 flex-1 min-w-0 md:order-none md:flex-none font-mono text-xs font-bold text-gray-800 group-hover:text-[#7B1A1A] transition-colors truncate">
                      {job.job_code}
                    </span>
                    <span className="order-3 w-full md:order-none md:w-auto text-xs text-gray-500 truncate">{job.drawing_name || '-'}</span>
                    <span className="order-4 md:order-none text-xs font-bold text-gray-700 md:text-center whitespace-nowrap">
                      {job.quantity} <span className="font-normal text-gray-400">ชิ้น</span>
                    </span>
                    <span className="order-5 md:order-none text-[11px] whitespace-nowrap">
                      {job.target_time ? (
                        <span className="text-gray-500">
                          {job.target_time.slice(0, 5)} / {(job.elapsed_time || '00:00:00').slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                      {job.is_overtime && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-red-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> +{secondsToHours(job.overtime_seconds)} ชม.
                        </span>
                      )}
                    </span>
                    <span className={`order-6 md:order-none text-[11px] font-medium whitespace-nowrap ${late ? 'text-red-500' : 'text-gray-500'}`}>
                      {formatDateShort(job.due_date)}
                    </span>
                    <span className={`order-2 md:order-none text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                      done ? 'bg-emerald-50 text-emerald-700' : late ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                    }`}>{job.status || '-'}</span>
                    <Button size="sm" variant="ghost"
                      onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                      className="order-7 ml-auto md:order-none md:ml-0 h-7 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      ใบงาน <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/40 px-4 sm:px-5 py-3.5">
                <p className="text-xs text-gray-500">
                  <span className="font-bold text-gray-800">{(page - 1) * PAGE_SIZE + 1}</span>–
                  <span className="font-bold text-gray-800">{Math.min(page * PAGE_SIZE, total)}</span>
                  {' '}/ <span className="font-bold text-gray-800">{total.toLocaleString()}</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
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
                        className={`h-8 w-8 p-0 rounded-full text-xs ${page === p ? 'bg-[#7B1A1A] hover:bg-[#5C1212] text-white border-none' : 'border-gray-200'}`}>
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
