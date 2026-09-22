'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Activity, CheckCircle2, ScanBarcode, ArrowRight, RefreshCw } from 'lucide-react'
import { ProjectTable } from '@/components/pages/process-qrcode/ProjectTable'
import { AddProjectDialog } from '@/components/pages/process-qrcode/AddProjectDialog'
import { ImportExcelDialog } from '@/components/pages/process-qrcode/ImportExcelDialog'

const API_URL = '/api/projects'
const ITEMS_PER_PAGE = 10

interface Project {
  project_id: string
  received_date: string
  due_date: string
  progress?: {
    status: 'none' | 'not_started' | 'in_progress' | 'done'
    current_step: string
    extra_steps: number
    elapsed_seconds: number
    jobs_total: number
    jobs_done: number
    active_steps?: { process: string; count: number }[]
    active_jobs?: { job_code: string; drawing_name: string; job_note: string; process: string }[]
  }
}

interface MatchedJob {
  job_code: string
  level1?: string
  drawing_name?: string
  quantity?: number
  status?: string
}

export default function ProcessQRCodePage() {
  const router = useRouter()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanValueRef = useRef('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processFilter, setProcessFilter] = useState<string | null>(null)
  const [matchedJobs, setMatchedJobs] = useState<MatchedJob[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [scanValue, setScanValue] = useState('')
  const [scanFlash, setScanFlash] = useState(false)

  const navigate = useCallback((raw: string) => {
    const jobId = raw.split('|')[0].trim().toUpperCase()
    if (!jobId) return
    setScanFlash(true)
    setTimeout(() => setScanFlash(false), 600)
    router.push(`/dashboard/process-details/${encodeURIComponent(jobId)}`)
  }, [router])

  // รับ event จาก GlobalBarcodeScanner (กรณีสแกนขณะไม่ได้ focus ที่ input)
  useEffect(() => {
    const handler = (e: Event) => {
      const raw = (e as CustomEvent).detail?.barcode?.trim()
      if (!raw) return
      e.preventDefault()
      navigate(raw)
    }
    document.addEventListener('onBarcodeScan', handler)
    return () => document.removeEventListener('onBarcodeScan', handler)
  }, [navigate])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Also search inside sub-jobs (job_code / drawing_name) so a match there
  // surfaces its parent project row (and the matched jobs themselves), even
  // if the project_id itself doesn't match.
  useEffect(() => {
    const term = search.trim()
    if (!term) {
      setMatchedJobs([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/jobs?search=${encodeURIComponent(term)}&limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        const jobs: MatchedJob[] = Array.isArray(json) ? json : (json.jobs ?? [])
        setMatchedJobs(jobs)
      } catch {
        setMatchedJobs([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const normalize = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
  const matchedLevel1s = new Set(matchedJobs.map((j) => j.level1).filter((l): l is string => Boolean(l)))
  const processCounts = new Map<string, number>()
  for (const project of projects) {
    for (const step of project.progress?.active_steps ?? []) {
      processCounts.set(step.process, (processCounts.get(step.process) ?? 0) + step.count)
    }
  }
  const processSummary = Array.from(processCounts, ([process, count]) => ({ process, count }))
    .sort((a, b) => b.count - a.count || a.process.localeCompare(b.process, 'th'))
  const maxProcessCount = processSummary[0]?.count ?? 1

  const filtered = projects.filter((p) => {
    if (processFilter && !p.progress?.active_steps?.some((step) => step.process === processFilter)) return false
    if (!search) return true
    const term = normalize(search)
    if (normalize(p.project_id).includes(term)) return true
    // Excel-imported project_id IS the level1 code; dialog-created ones need a "J" prefix to match level1
    return matchedLevel1s.has(p.project_id) || matchedLevel1s.has(`J${p.project_id}`)
  })
  const processJobs = processFilter
    ? filtered.flatMap((project) => (project.progress?.active_jobs ?? [])
      .filter((job) => job.process === processFilter)
      .map((job) => ({ ...job, projectId: project.project_id })))
      .sort((a, b) => a.job_code.localeCompare(b.job_code))
    : []
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <QrCode className="h-3 w-3" /> QR CODE PROCESS TRACKING
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ติดตามกระบวนการด้วย QR Code</h1>
          <p className="mt-1 text-xs text-gray-500">
            สแกนและตรวจสอบสถานะการผลิต ระยะเวลาที่ใช้ และกำหนดส่งมอบแต่ละโปรเจค
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-gray-50 border border-gray-100">
            <Activity className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-[10px] text-gray-400 font-medium">โปรเจคทั้งหมด</p>
              <p className="text-xs font-bold text-gray-800">{projects.length} รายการ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-emerald-50/60 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-[10px] text-emerald-600/80 font-medium">กำลังดำเนินการ</p>
              <p className="text-xs font-bold text-emerald-700">{projects.filter((p) => p.progress?.status === 'in_progress').length} รายการ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Zone */}
      <div
        className={`rounded-xl border-2 transition-all duration-300 cursor-pointer ${
          scanFlash
            ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100'
            : 'border-dashed border-gray-200 bg-white hover:border-[#7B1A1A]/40 hover:bg-red-50/30'
        }`}
        onClick={() => scanInputRef.current?.focus()}
      >
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-4 sm:px-6 sm:py-5">
          <div className={`flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            scanFlash ? 'bg-emerald-100' : 'bg-red-50'
          }`}>
            <ScanBarcode className={`h-7 w-7 transition-colors ${scanFlash ? 'text-emerald-600' : 'text-[#7B1A1A]'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 mb-1">สแกนบาร์โค้ด / QR Code เพื่อเปิดใบงาน</p>
            <input
              ref={scanInputRef}
              type="text"
              value={scanValue}
              onChange={(e) => {
                const val = e.target.value
                setScanValue(val)
                scanValueRef.current = val
                if (!val.trim()) return
                if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
                scanTimerRef.current = setTimeout(() => {
                  const v = scanValueRef.current
                  if (v.trim()) {
                    navigate(v.trim())
                    setScanValue('')
                    scanValueRef.current = ''
                  }
                }, 300)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scanValue.trim()) {
                  if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
                  navigate(scanValue.trim())
                  setScanValue('')
                }
              }}
              placeholder="คลิกที่นี่แล้วสแกน หรือพิมพ์รหัสใบงาน แล้วกด Enter..."
              className="w-full text-sm text-gray-700 placeholder-gray-400 bg-transparent border-0 outline-none focus:ring-0 p-0"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500">
              Enter
            </kbd>
            <ArrowRight className="h-4 w-4 text-gray-300" />
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 shadow-sm" aria-label="สรุป Process ปัจจุบัน">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#7B1A1A]" /> งานอยู่ที่ Process ไหน
            </h2>
            <p className="text-xs text-gray-500 mt-1">นับ Job ย่อยตามขั้นตอนถัดไปที่ยังไม่เสร็จ กดการ์ดเพื่อดูใบงานใน Process นั้น</p>
          </div>
          <div className="flex items-center gap-3">
            {processFilter && (
              <button type="button" onClick={() => { setProcessFilter(null); setCurrentPage(1) }}
                className="text-xs font-semibold text-[#7B1A1A] hover:underline">แสดงทุก Process</button>
            )}
            <button type="button" onClick={() => { void fetchProjects() }} disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#7B1A1A] disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> อัปเดต
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400">กำลังโหลดข้อมูล Process...</p>
        ) : processSummary.length === 0 ? (
          <p className="text-xs text-gray-400">ยังไม่มี Job ที่ระบุ Process</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {processSummary.map(({ process, count }) => (
              <button key={process} type="button" aria-pressed={processFilter === process}
                onClick={() => { setProcessFilter(processFilter === process ? null : process); setCurrentPage(1) }}
                className={`rounded-xl border p-3 text-left transition-colors ${processFilter === process
                  ? 'border-[#7B1A1A] bg-red-50'
                  : 'border-gray-100 bg-gray-50/60 hover:border-[#7B1A1A]/40 hover:bg-red-50/30'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 break-words">{process}</span>
                  <span className="text-sm font-bold text-[#7B1A1A] shrink-0">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden">
                  <div className="h-full rounded-full bg-[#7B1A1A]" style={{ width: `${count / maxProcessCount * 100}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">Job ย่อย</span>
              </button>
            ))}
          </div>
        )}
        {processFilter && !loading && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-700 mb-2">Job ย่อยใน {processFilter} ({processJobs.length})</h3>
            {processJobs.length === 0 ? (
              <p className="text-xs text-gray-400">ไม่พบ Job ย่อยที่ตรงกับตัวกรอง</p>
            ) : (
              <div className="max-h-80 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
                {processJobs.map((job) => (
                  <button key={`${job.projectId}:${job.job_code}`} type="button"
                    onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-left hover:border-[#7B1A1A]/40 hover:bg-red-50/40 transition-colors">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-bold text-[#7B1A1A] truncate">{job.job_code}{job.job_note ? `-${job.job_note}` : ''}</span>
                      <span className="block text-xs text-gray-600 truncate">{job.drawing_name || 'ไม่มีชื่อแบบ'}</span>
                      <span className="block text-[10px] text-gray-400">โปรเจกต์ {job.projectId}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <ProjectTable
        projects={paginated}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        filteredCount={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        search={search}
        onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
        matchedJobs={matchedJobs}
        onOpenAddDialog={() => setDialogOpen(true)}
        onOpenImportDialog={() => setImportOpen(true)}
        onDeleted={fetchProjects}
      />

      <AddProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchProjects}
      />

      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchProjects}
      />
    </div>
  )
}
