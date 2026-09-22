'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  QrCode,
  Loader2,
  Plus,
  Receipt,
  ClipboardCheck,
  FileText,
  Trash2,
  AlertTriangle,
  Printer,
  Pencil,
  LockKeyhole,
} from 'lucide-react'
import { AddJobDialog } from '@/components/pages/job-list/AddJobDialog'
import { EditJobDialog } from '@/components/pages/job-list/EditJobDialog'
import { FileThumbnail } from '@/components/pages/process-qrcode/FileThumbnail'
import { FilePreviewDialog } from '@/components/pages/process-qrcode/FilePreviewDialog'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'
import type { ProcessRow } from '@/components/pages/process-details/ProcessTable'
import { useCurrentUser } from '@/lib/useCurrentUser'

interface ProcessEntry {
  process: string
  person: string
  time_hours: number
}

interface Attachment {
  file_url: string
  file_name: string
}

interface Job {
  _id?: string
  job_code: string
  job_note?: string
  level1: string
  level2: string | null
  level3: string | null
  drawing_name: string
  quantity: number
  completed: number
  remaining: number
  status: string
  processes: ProcessEntry[]
  coating: string
  outsource_process: string
  due_date: string
  sheet_name: string
  file_url?: string
  file_name?: string
  attachments?: Attachment[]
  current_process_name?: string | null
  current_process_active?: boolean
  sale_closed_at?: string | null
}

interface PrintableJob {
  jobId: string
  dwgName: string
  receivedDate: string
  dueDate: string
  processList: ProcessRow[]
  fileUrl?: string
  fileName?: string
  attachments?: Attachment[]
}

function formatDate(d: string) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return d }
}

function formatPrintDate(d: string) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return d }
}

function normalizeStatus(s: string) {
  if (s === 'FN_GOOD') return 'จบงาน'
  if (s === 'ACPT_FN') return 'รับงาน'
  if (s === 'CANCEL_FN') return 'ไม่รับงาน'
  if (s === 'ยกเลิก' || s === 'CMD_REJECT') return 'REJECT'
  return s
}

function isJobDone(status: string) {
  const s = normalizeStatus(status)
  return s === 'จบงาน' || s === 'รับงาน'
}

function StatusChip({
  status,
  currentProcessName,
  currentProcessActive,
}: {
  status: string
  currentProcessName?: string | null
  currentProcessActive?: boolean
}) {
  const s = normalizeStatus(status)
  if (s === 'จบงาน' || s === 'รับงาน') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {s}
      </span>
    )
  }
  if (s === 'ไม่รับงาน') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700">
        <XCircle className="h-2.5 w-2.5" />
        {s}
      </span>
    )
  }
  if (s === 'REJECT') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-800">
        <XCircle className="h-2.5 w-2.5" />
        REJECT
      </span>
    )
  }
  // All processes confirmed but no final status yet
  if (currentProcessName === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
        <CheckCircle2 className="h-2.5 w-2.5" />
        รอรับงาน
      </span>
    )
  }
  // Show current process name
  if (currentProcessName) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 max-w-[140px] truncate" title={currentProcessName}>
        <Clock className="h-2.5 w-2.5 shrink-0" />
        {currentProcessActive ? 'กำลังทำ' : 'รอ'}: {currentProcessName}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
      <Clock className="h-2.5 w-2.5" />
      {s === 'in_progress' || !s ? 'กำลังดำเนินการ' : s}
    </span>
  )
}


function JobThumbnail({
  job,
  size,
  onPreview,
  isReadOnly,
}: {
  job: Job
  size: number
  onPreview: (a: Attachment, attachments?: Attachment[]) => void
  isReadOnly?: boolean
}) {
  const hasPdf = job.attachments?.some((a) => a.file_name.split('.').pop()?.toLowerCase() === 'pdf')
  const has3D = job.file_name && ['stl','obj','glb','gltf','step','stp'].includes(job.file_name.split('.').pop()?.toLowerCase() ?? '')
  const showPdfBadge = hasPdf && has3D

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      {job.file_url && job.file_name ? (
        <FileThumbnail
          fileUrl={job.file_url}
          fileName={job.file_name}
          size={size}
          onClick={isReadOnly ? undefined : () => onPreview({ file_url: job.file_url!, file_name: job.file_name! }, job.attachments)}
        />
      ) : (
        <div style={{ width: size, height: size }} className="rounded-lg border border-dashed border-gray-100" />
      )}
      {showPdfBadge && !isReadOnly && (
        <button
          onClick={() => onPreview({ file_url: job.file_url!, file_name: job.file_name! }, job.attachments)}
          className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded px-1.5 py-0.5 transition-colors"
        >
          <FileText className="h-2.5 w-2.5" /> PDF
        </button>
      )}
    </div>
  )
}

export default function JobListPage() {
  const { parentId } = useParams<{ parentId: string }>()
  const router = useRouter()
  const { role } = useCurrentUser()
  // role "User" และ "ช่าง" ดูรายการนี้ได้อย่างเดียว — ซ่อนปุ่มใบเสนอราคา, QC, เพิ่ม Job ย่อย
  const isReadOnly = role === 'User' || role === 'ช่าง'
  const normalizedRole = role.trim().toLowerCase()
  const canCloseSale = normalizedRole === 'superadmin'
  // ช่างต้องเปิดดูไฟล์ PDF/3D ได้ (ต้องใช้แบบงานจริง) — จำกัดเฉพาะ role User เท่านั้นที่เปิดไม่ได้
  const canViewFile = role !== 'User'
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [preview, setPreview] = useState<{ url: string; name: string; attachments?: Attachment[] } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [closeSaleTarget, setCloseSaleTarget] = useState<string | null>(null)
  const [closeSaleMode, setCloseSaleMode] = useState<'close' | 'reopen'>('close')
  const [closingSale, setClosingSale] = useState(false)
  const [closeSaleError, setCloseSaleError] = useState('')
  const [printingGroup, setPrintingGroup] = useState<string | null>(null)
  const [printError, setPrintError] = useState('')
  const [printJobs, setPrintJobs] = useState<PrintableJob[]>([])
  const [printPreviewGroup, setPrintPreviewGroup] = useState<string | null>(null)

  function handlePrintGroup(groupCode: string, groupJobs: Job[]) {
    if (groupJobs.length === 0) return
    const ids = groupJobs.map((job) => encodeURIComponent(job.job_code)).join(',')
    router.push(`/dashboard/job-list/${encodeURIComponent(parentId)}/print?group=${encodeURIComponent(groupCode)}&ids=${ids}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/projects/${encodeURIComponent(deleteTarget)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'ลบไม่สำเร็จ')
      setDeleteTarget(null)
      loadJobs()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmCloseSale() {
    if (!closeSaleTarget) return
    setClosingSale(true)
    setCloseSaleError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/jobs/close-group', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level2: closeSaleTarget, closed: closeSaleMode === 'close' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ปิดการขายไม่สำเร็จ')
      setCloseSaleTarget(null)
      await loadJobs()
    } catch (error: unknown) {
      setCloseSaleError(error instanceof Error ? error.message : 'ปิดการขายไม่สำเร็จ')
    } finally {
      setClosingSale(false)
    }
  }

  async function loadJobs() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const fetchLevel1 = async (level1: string) => {
        const res = await fetch(`/api/jobs?level1=${encodeURIComponent(level1)}&limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        return Array.isArray(json) ? json : (json.jobs ?? [])
      }

      // Some jobs get created without the "J" prefix by mistake (e.g. a level1
      // shell saved as "A-2909" instead of "JA-2909") — always fetch BOTH forms
      // and merge, so a sibling group under the other prefix never disappears
      // just because the other variant already returned results.
      const variants = parentId.toUpperCase().startsWith('J')
        ? [parentId]
        : [parentId, `J${parentId}`]
      const results = await Promise.all(variants.map(fetchLevel1))
      const seen = new Set<string>()
      const data: Job[] = []
      for (const list of results) {
        for (const j of list) {
          if (seen.has(j.job_code)) continue
          seen.add(j.job_code)
          data.push(j)
        }
      }
      setJobs(data)
      // auto-expand all level2 groups
      const allKeys = new Set<string>(data.map((j: Job) => j.level2 ?? j.job_code))
      setExpanded(allKeys)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadJobs() }, [parentId])

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Group by level2
  const byLevel2 = new Map<string, Job[]>()
  for (const job of jobs) {
    const key = job.level2 ?? job.job_code
    if (!byLevel2.has(key)) byLevel2.set(key, [])
    byLevel2.get(key)!.push(job)
  }

  const totalQty = jobs.reduce((s, j) => s + j.quantity, 0)
  const doneCount = jobs.filter((j) => isJobDone(j.status)).length

  return (
    <>
    <div className="space-y-6 font-sans print:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="gap-2 rounded-full border-gray-200 text-gray-700 h-9 px-4 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          ย้อนกลับ
        </Button>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <Button
              onClick={() => setAddOpen(true)}
              className="gap-2 rounded-full h-9 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-4 text-xs font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              เพิ่ม Job ย่อย
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
                <Layers className="h-3 w-3" /> JOB HIERARCHY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 font-mono break-all">{parentId}</h1>
            <p className="text-xs text-gray-400 mt-1">รายการงานทั้งหมดภายใต้โปรเจคหลักนี้</p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-gray-50 border border-gray-100">
              <Layers className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">กลุ่มงาน (L2)</p>
                <p className="text-xs font-bold text-gray-800">{byLevel2.size} กลุ่ม</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-gray-50 border border-gray-100">
              <QrCode className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">รายการทั้งหมด</p>
                <p className="text-xs font-bold text-gray-800">{jobs.length} รายการ · {totalQty} ชิ้น</p>
              </div>
            </div>
            <div className="col-span-2 sm:col-auto flex items-center gap-2 rounded-xl px-3.5 py-2 bg-emerald-50/60 border border-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-[10px] text-emerald-600/70 font-medium">เสร็จแล้ว</p>
                <p className="text-xs font-bold text-emerald-700">{doneCount} / {jobs.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/70 overflow-hidden">
          {byLevel2.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <Layers className="h-8 w-8 opacity-30" />
              <p className="text-sm">ไม่พบรายการงานสำหรับ {parentId}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Array.from(byLevel2.entries()).map(([level2Code, items]) => {
                const hasLevel3 = items.some((j) => j.level3)
                const isOpen = expanded.has(level2Code)
                const doneInGroup = items.filter((j) => isJobDone(j.status)).length
                const groupQty = items.reduce((s, j) => s + j.quantity, 0)
                const processes = [...new Set(items.flatMap((j) => j.processes.map((p) => p.process)).filter(Boolean))]
                const coatings = [...new Set(items.map((j) => j.coating).filter(Boolean))]
                const minDue = items.map((j) => j.due_date).filter(Boolean).sort()[0]
                const saleClosed = items.some((job) => Boolean(job.sale_closed_at))

                // If no level3 → single job, link directly to process-details
                const singleJob = !hasLevel3 && items.length === 1 ? items[0] : null

                return (
                  <div key={level2Code}>
                    {/* Level 2 row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4 px-3 py-3 sm:px-6 hover:bg-gray-50/70 transition-colors group">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggle(level2Code)}
                        className="text-gray-300 hover:text-gray-500 shrink-0 w-5"
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {/* Code */}
                      <div className="min-w-0 flex-1 sm:flex-none sm:w-48 sm:shrink-0">
                        <span className="font-mono font-bold text-sm break-all text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
                          {level2Code}
                        </span>
                        {singleJob?.drawing_name && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5 sm:max-w-[180px]">{singleJob.drawing_name}</p>
                        )}
                      </div>

                      {/* Count + progress bar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500">
                          {hasLevel3 ? `${items.length} BU` : `${groupQty} ชิ้น`}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${items.length ? (doneInGroup / items.length) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400">{doneInGroup}/{items.length}</span>
                      </div>

                      {/* Process chips */}
                      <div className="hidden md:flex gap-1.5 flex-wrap flex-1">
                        {processes.slice(0, 4).map((p) => (
                          <span key={p} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                            {p}
                          </span>
                        ))}
                        {coatings.slice(0, 2).map((c) => (
                          <span key={c} className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Due date */}
                      {minDue && (
                        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(minDue)}
                        </div>
                      )}

                      {/* แถวกลุ่ม Level 2 ไม่มีสถานะของตัวเอง สถานะเป็นของ Job ย่อยแต่ละรายการ */}
                      {!hasLevel3 && <div className="shrink-0">
                        {singleJob ? (
                          <StatusChip
                            status={singleJob.status}
                            currentProcessName={singleJob.current_process_name}
                            currentProcessActive={singleJob.current_process_active}
                          />
                        ) : (
                          doneInGroup === items.length && items.length > 0
                            ? <StatusChip status="จบงาน" />
                            : doneInGroup > 0
                              ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                                  <Clock className="h-2.5 w-2.5" />
                                  {doneInGroup}/{items.length} เสร็จ
                                </span>
                              : <StatusChip
                                  status={items[0]?.status ?? ''}
                                  currentProcessName={items[0]?.current_process_name}
                                  currentProcessActive={items[0]?.current_process_active}
                                />
                        )}
                      </div>}

                      {/* Action */}
                      <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
                        {saleClosed ? (
                          canCloseSale ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setCloseSaleError(''); setCloseSaleMode('reopen'); setCloseSaleTarget(level2Code) }}
                              className="h-8 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 gap-1"
                            >
                              <LockKeyhole className="h-3.5 w-3.5" /> เปิดการขายอีกครั้ง
                            </Button>
                          ) : (
                            <span className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                              <LockKeyhole className="h-3.5 w-3.5" /> ปิดการขายแล้ว
                            </span>
                          )
                        ) : canCloseSale ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setCloseSaleError(''); setCloseSaleMode('close'); setCloseSaleTarget(level2Code) }}
                            className="h-8 rounded-full text-amber-700 hover:bg-amber-50 hover:text-amber-800 text-xs font-semibold gap-1"
                          >
                            <LockKeyhole className="h-3.5 w-3.5" /> ปิดการขาย
                          </Button>
                        ) : null}
                        {!isReadOnly && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintGroup(level2Code, items)}
                            disabled={printingGroup !== null}
                            className="h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-xs font-semibold gap-1"
                          >
                            {printingGroup === level2Code
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Printer className="h-3.5 w-3.5" />}
                            {printingGroup === level2Code ? 'กำลังเตรียม...' : 'พิมพ์กลุ่มนี้'}
                          </Button>
                        )}
                        {!isReadOnly && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/quotation/${encodeURIComponent(level2Code)}`)}
                            className="h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-xs font-semibold gap-1"
                          >
                            <Receipt className="h-3.5 w-3.5" /> ใบเสนอราคา
                          </Button>
                        )}
                        {singleJob ? (
                          <>
                            {/* No BU → link directly to process-details */}
                            {!isReadOnly && (
                              <Button size="sm" variant="ghost" onClick={() => setEditJob(singleJob)}
                                className="h-8 rounded-full text-gray-500 hover:bg-gray-100 text-xs gap-1">
                                <Pencil className="h-3.5 w-3.5" /> แก้ไข
                              </Button>
                            )}
                            {!isReadOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/process-details/${level2Code}/qc`)}
                                className="h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-xs font-semibold gap-1"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" /> QC
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${level2Code}`)}
                              className="h-8 rounded-full text-[#7B1A1A] hover:bg-red-50 text-xs font-semibold gap-1"
                            >
                              เปิดใบงาน <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            {!isReadOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setDeleteError(''); setDeleteTarget(singleJob.job_code) }}
                                className="h-8 w-8 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => toggle(level2Code)}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                          >
                            {isOpen ? 'ย่อ' : `ดู ${items.length} รายการ`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Level 3 sub-items */}
                    {isOpen && hasLevel3 && (
                      <div className="bg-gray-50/40 border-t border-gray-100">
                        {/* Sub-header */}
                        <div className="hidden md:grid grid-cols-[56px_1.5fr_2.5fr_auto_auto_auto_auto] gap-4 px-12 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                          <span></span>
                          <span>BU Code</span>
                          <span>ชื่อแบบ</span>
                          <span className="text-center">จำนวน</span>
                          <span>Process</span>
                          <span>กำหนดส่ง</span>
                          <span></span>
                        </div>

                        {items.map((job, idx) => (
                          <div
                            key={job.job_code}
                            className={`flex flex-col gap-2.5 px-4 py-3 md:grid md:grid-cols-[56px_1.5fr_2.5fr_auto_auto_auto_auto] md:gap-4 md:px-12 md:py-2 md:items-center ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            } hover:bg-red-50/20 transition-colors`}
                          >
                            <div className="flex items-center gap-3 md:contents">
                              {/* Thumbnail */}
                              <JobThumbnail
                                job={job}
                                size={48}
                                isReadOnly={!canViewFile}
                                onPreview={(a, atts) => setPreview({ url: a.file_url, name: a.file_name, attachments: atts })}
                              />
                              <div className="min-w-0 flex-1 md:contents">
                                <span className="block font-mono text-xs font-semibold text-gray-700 break-all md:break-normal">
                                  {[job.job_code, job.job_note?.trim()].filter(Boolean).join('-')}
                                </span>
                                <span className="block text-xs text-gray-500 truncate">{job.drawing_name}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:contents">
                              <div className="md:text-center">
                                <span className="text-xs font-bold text-gray-700">{job.quantity}</span>
                                <span className="text-[10px] text-gray-400"> ชิ้น</span>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {job.processes.slice(0, 2).map((p, i) => (
                                  <span key={i} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    {p.process}
                                  </span>
                                ))}
                                {job.coating && (
                                  <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">
                                    {job.coating}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-gray-500">{formatDate(job.due_date)}</span>
                                <StatusChip
                                  status={job.status}
                                  currentProcessName={job.current_process_name}
                                  currentProcessActive={job.current_process_active}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              {!isReadOnly && (
                                <Button size="sm" variant="ghost" onClick={() => setEditJob(job)}
                                  className="h-7 rounded-full text-gray-500 hover:bg-gray-100 text-[11px] gap-1 px-2.5">
                                  <Pencil className="h-3 w-3" /> แก้ไข
                                </Button>
                              )}
                              {!isReadOnly && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}/qc`)}
                                  className="h-7 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-semibold gap-1 px-2.5"
                                >
                                  <ClipboardCheck className="h-3 w-3" /> QC
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                                className="h-7 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5"
                              >
                                ใบงาน <ExternalLink className="h-3 w-3" />
                              </Button>
                              {!isReadOnly && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setDeleteError(''); setDeleteTarget(job.job_code) }}
                                  className="h-7 w-7 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Level 2 expanded (no BU, multiple rows) */}
                    {isOpen && !hasLevel3 && items.length > 1 && (
                      <div className="bg-gray-50/40 border-t border-gray-100">
                        {items.map((job, idx) => (
                          <div
                            key={job.job_code}
                            className={`flex flex-wrap items-center gap-x-3 gap-y-2 md:gap-4 px-4 py-3 md:px-12 md:py-2 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            } hover:bg-red-50/20 transition-colors`}
                          >
                            <JobThumbnail
                              job={job}
                              size={48}
                              isReadOnly={!canViewFile}
                              onPreview={(a, atts) => setPreview({ url: a.file_url, name: a.file_name, attachments: atts })}
                            />
                            <span className="font-mono text-xs font-semibold text-gray-700 md:w-40 md:shrink-0 break-all md:break-normal">
                              {[job.job_code, job.job_note?.trim()].filter(Boolean).join('-')}
                            </span>
                            <span className="text-xs text-gray-500 flex-1 min-w-[8rem] truncate">{job.drawing_name}</span>
                            <StatusChip
                              status={job.status}
                              currentProcessName={job.current_process_name}
                              currentProcessActive={job.current_process_active}
                            />
                            {!isReadOnly && (
                              <Button size="sm" variant="ghost" onClick={() => setEditJob(job)}
                                className="h-7 rounded-full text-gray-500 hover:bg-gray-100 text-[11px] gap-1 px-2.5">
                                <Pencil className="h-3 w-3" /> แก้ไข
                              </Button>
                            )}
                            {!isReadOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}/qc`)}
                                className="h-7 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-semibold gap-1 px-2.5"
                              >
                                <ClipboardCheck className="h-3 w-3" /> QC
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                              className="h-7 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5"
                            >
                              ใบงาน <ExternalLink className="h-3 w-3" />
                            </Button>
                            {!isReadOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setDeleteError(''); setDeleteTarget(job.job_code) }}
                                className="h-7 w-7 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {printError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{printError}</p>
      )}

      <AddJobDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        parentId={parentId}
        onSuccess={loadJobs}
      />

      {editJob && (
        <EditJobDialog key={editJob.job_code} job={editJob} onClose={() => setEditJob(null)} onSuccess={loadJobs} />
      )}

      {preview && (
        <FilePreviewDialog
          open={!!preview}
          onOpenChange={(v) => { if (!v) setPreview(null) }}
          fileUrl={preview.url}
          fileName={preview.name}
          attachments={preview.attachments}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError('') } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-6 bg-white border-0 font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ยืนยันการลบ Job
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              ต้องการลบ Job <span className="font-mono font-bold text-gray-700">{deleteTarget}</span> ใช่หรือไม่?
              การลบไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{deleteError}</p>
          )}

          <DialogFooter className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteError('') }}
              disabled={deleting}
              className="rounded-full h-9 border-gray-200"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-full h-9 bg-red-600 hover:bg-red-700 text-white px-5 gap-1"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {deleting ? 'กำลังลบ...' : 'ลบ Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeSaleTarget} onOpenChange={(open) => { if (!open && !closingSale) { setCloseSaleTarget(null); setCloseSaleError('') } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-0 bg-white p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <LockKeyhole className="h-5 w-5 text-amber-600" />
              {closeSaleMode === 'close' ? 'ยืนยันปิดการขาย' : 'ยืนยันเปิดการขายอีกครั้ง'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-gray-500">
              {closeSaleMode === 'close' ? (
                <>ปิดการขายกลุ่ม <span className="font-mono font-bold text-gray-700">{closeSaleTarget}</span> แล้วจะไม่สามารถเพิ่ม Job ใหม่เข้าเลขกลุ่มนี้ได้ ระบบจะใช้เลขกลุ่มถัดไปโดยอัตโนมัติ</>
              ) : (
                <>เปิดการขายกลุ่ม <span className="font-mono font-bold text-gray-700">{closeSaleTarget}</span> อีกครั้ง เพื่อให้สามารถเพิ่ม Job ใหม่เข้าเลขกลุ่มนี้ได้</>
              )}
            </DialogDescription>
          </DialogHeader>
          {closeSaleError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{closeSaleError}</p>}
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setCloseSaleTarget(null); setCloseSaleError('') }}
              disabled={closingSale}
              className="h-9 rounded-full border-gray-200"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCloseSale}
              disabled={closingSale}
              className="h-9 rounded-full bg-amber-600 px-5 text-white hover:bg-amber-700"
            >
              {closingSale ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-1 h-3.5 w-3.5" />}
              {closingSale
                ? (closeSaleMode === 'close' ? 'กำลังปิด...' : 'กำลังเปิด...')
                : (closeSaleMode === 'close' ? 'ปิดการขาย' : 'เปิดการขายอีกครั้ง')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    {printPreviewGroup && (
      <div id="group-print-overlay" className="fixed inset-0 z-[9999] overflow-y-auto bg-gray-300 font-sans">
        <style>{`
          @media screen {
            .group-print-sheet #print-area { display: block !important; }
            .group-print-sheet .print-page {
              margin: 0 auto 20px;
              border: 1px solid #bbb;
              box-shadow: 0 2px 8px rgba(0,0,0,.15);
              width: 210mm;
              min-height: 297mm;
              background-color: #fff;
            }
            .group-print-sheet .drawing-print-page {
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }
          @media print {
            @page { size: A4 portrait; margin: 0; }
            html, body {
              width: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            [data-slot="sidebar-wrapper"] > *:not([data-slot="sidebar-inset"]) { display: none !important; }
            [data-slot="sidebar-wrapper"] {
              display: block !important;
              min-height: 0 !important;
              height: auto !important;
            }
            header { display: none !important; }
            main {
              padding: 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              height: auto !important;
              overflow: visible !important;
              background: #fff !important;
              flex: none !important;
            }
            #group-print-overlay {
              position: static !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: #fff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            #group-print-toolbar { display: none !important; }
            #group-print-pages { padding: 0 !important; margin: 0 !important; background: #fff !important; }
            .group-print-sheet #print-area { display: block !important; }
            .group-print-sheet .print-page {
              width: 210mm !important;
              max-width: 210mm !important;
              height: 295mm !important;
              max-height: 295mm !important;
              min-height: 0 !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              padding: 10mm 12mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
            }
            .group-print-sheet .drawing-print-page {
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .group-print-sheet:last-child #print-area > div:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        `}</style>
        <div id="group-print-toolbar" className="sticky top-0 z-10 mb-5 flex items-center justify-between gap-2 bg-[#1a1a2e] px-3 sm:px-6 py-2.5 text-white">
          <button
            type="button"
            onClick={() => setPrintPreviewGroup(null)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> กลับ
          </button>
          <div className="hidden sm:flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo2.png" alt="Sistomat" className="h-8 w-auto" />
            <div className="font-bold text-indigo-100">ตัวอย่างก่อนปริ้น — {printPreviewGroup}</div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full bg-[#7B1A1A] px-5 py-2 text-sm font-bold text-white hover:bg-[#5C1212]"
          >
            <Printer className="h-4 w-4" /> ปริ้นเลย
          </button>
        </div>
        <div id="group-print-pages" className="p-6">
          {printJobs.map((job) => (
            <div key={job.jobId} className="group-print-sheet">
              <PrintJobSheet
                jobId={job.jobId}
                dwgName={job.dwgName}
                receivedDate={job.receivedDate}
                dueDate={job.dueDate}
                processList={job.processList}
                fileUrl={job.fileUrl}
                fileName={job.fileName}
                attachments={job.attachments}
              />
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  )
}
