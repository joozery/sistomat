'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Activity, CheckCircle2, ScanBarcode, ArrowRight } from 'lucide-react'
import { ProjectTable } from '@/components/pages/process-qrcode/ProjectTable'
import { AddProjectDialog } from '@/components/pages/process-qrcode/AddProjectDialog'
import { ImportExcelDialog } from '@/components/pages/process-qrcode/ImportExcelDialog'

const API_URL = '/api/projects'
const ITEMS_PER_PAGE = 10

interface Project {
  project_id: string
  received_date: string
  due_date: string
}

interface MatchedJob {
  job_code: string
  level1?: string
  drawing_name?: string
  quantity?: number
  status?: string
}

const demoProjects: Project[] = [
  { project_id: 'PRJ-2025-081', received_date: '2025-07-28', due_date: '2025-08-05' },
  { project_id: 'PRJ-2025-082', received_date: '2025-07-29', due_date: '2025-08-06' },
  { project_id: 'PRJ-2025-083', received_date: '2025-07-30', due_date: '2025-08-07' },
  { project_id: 'PRJ-2025-084', received_date: '2025-07-31', due_date: '2025-08-08' },
  { project_id: 'PRJ-2025-085', received_date: '2025-07-31', due_date: '2025-08-09' },
]

export default function ProcessQRCodePage() {
  const router = useRouter()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanValueRef = useRef('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
      if (Array.isArray(data) && data.length > 0) {
        setProjects(data)
      } else {
        setProjects(demoProjects)
      }
    } catch {
      setProjects(demoProjects)
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

  const filtered = projects.filter((p) => {
    if (!search) return true
    const term = normalize(search)
    if (normalize(p.project_id).includes(term)) return true
    // Excel-imported project_id IS the level1 code; dialog-created ones need a "J" prefix to match level1
    return matchedLevel1s.has(p.project_id) || matchedLevel1s.has(`J${p.project_id}`)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <QrCode className="h-3 w-3" /> QR CODE PROCESS TRACKING
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ติดตามกระบวนการด้วย QR Code</h1>
          <p className="mt-1 text-xs text-gray-500">
            สแกนและตรวจสอบสถานะการผลิต ระยะเวลาที่ใช้ และกำหนดส่งมอบแต่ละโปรเจค
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
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
              <p className="text-xs font-bold text-emerald-700">{projects.length} รายการ</p>
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
        <div className="flex items-center gap-5 px-6 py-5">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
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
