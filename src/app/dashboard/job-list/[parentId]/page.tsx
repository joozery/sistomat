'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  CheckCircle2,
  Clock,
  Calendar,
  QrCode,
  Loader2,
  Plus,
  Receipt,
  ClipboardCheck,
  FileText,
} from 'lucide-react'
import { AddJobDialog } from '@/components/pages/job-list/AddJobDialog'
import { FileThumbnail } from '@/components/pages/process-qrcode/FileThumbnail'
import { FilePreviewDialog } from '@/components/pages/process-qrcode/FilePreviewDialog'

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
}

function formatDate(d: string) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return d }
}

function StatusChip({ status }: { status: string }) {
  const done = status === 'ครบ' || status === 'รับแล้ว'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
      done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
      {status || '-'}
    </span>
  )
}


function JobThumbnail({
  job,
  size,
  onPreview,
}: {
  job: Job
  size: number
  onPreview: (a: Attachment, attachments?: Attachment[]) => void
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
          onClick={() => onPreview({ file_url: job.file_url!, file_name: job.file_name! }, job.attachments)}
        />
      ) : (
        <div style={{ width: size, height: size }} className="rounded-lg border border-dashed border-gray-100" />
      )}
      {showPdfBadge && (
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
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string; attachments?: Attachment[] } | null>(null)

  async function loadJobs() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/jobs?level1=${encodeURIComponent(parentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      const data = Array.isArray(json) ? json : (json.jobs ?? [])
      setJobs(data)
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
  const doneCount = jobs.filter((j) => j.status === 'ครบ' || j.status === 'รับแล้ว').length

  return (
    <div className="space-y-6 font-sans">
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
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/quotation/${encodeURIComponent(parentId)}`)}
            className="gap-2 rounded-full border-gray-200 text-gray-600 hover:text-gray-800 h-9 px-4 text-xs font-semibold"
          >
            <Receipt className="h-4 w-4" />
            ใบเสนอราคา
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            className="gap-2 rounded-full h-9 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-4 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม Job ย่อย
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
                <Layers className="h-3 w-3" /> JOB HIERARCHY
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 font-mono">{parentId}</h1>
            <p className="text-xs text-gray-400 mt-1">รายการงานทั้งหมดภายใต้โปรเจคหลักนี้</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
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
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 bg-emerald-50/60 border border-emerald-100">
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
                const doneInGroup = items.filter((j) => j.status === 'ครบ' || j.status === 'รับแล้ว').length
                const groupQty = items.reduce((s, j) => s + j.quantity, 0)
                const processes = [...new Set(items.flatMap((j) => j.processes.map((p) => p.process)).filter(Boolean))]
                const coatings = [...new Set(items.map((j) => j.coating).filter(Boolean))]
                const minDue = items.map((j) => j.due_date).filter(Boolean).sort()[0]

                // If no level3 → single job, link directly to process-details
                const singleJob = !hasLevel3 && items.length === 1 ? items[0] : null

                return (
                  <div key={level2Code}>
                    {/* Level 2 row */}
                    <div className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50/70 transition-colors group">
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
                      <div className="w-48 shrink-0">
                        <span className="font-mono font-bold text-sm text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
                          {level2Code}
                        </span>
                        {singleJob?.drawing_name && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5 max-w-[180px]">{singleJob.drawing_name}</p>
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

                      {/* Action */}
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {singleJob ? (
                          <>
                            {/* No BU → link directly to process-details */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${level2Code}/qc`)}
                              className="h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-xs font-semibold gap-1"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" /> QC
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${level2Code}`)}
                              className="h-8 rounded-full text-[#7B1A1A] hover:bg-red-50 text-xs font-semibold gap-1"
                            >
                              เปิดใบงาน <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
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
                        <div className="grid grid-cols-[56px_1.5fr_2.5fr_auto_auto_auto_auto] gap-4 px-12 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
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
                            className={`grid grid-cols-[56px_1.5fr_2.5fr_auto_auto_auto_auto] gap-4 px-12 py-2 items-center ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            } hover:bg-red-50/20 transition-colors`}
                          >
                            {/* Thumbnail */}
                            <JobThumbnail
                              job={job}
                              size={48}
                              onPreview={(a, atts) => setPreview({ url: a.file_url, name: a.file_name, attachments: atts })}
                            />
                            <span className="font-mono text-xs font-semibold text-gray-700">{job.job_code}</span>
                            <span className="text-xs text-gray-500 truncate">{job.drawing_name}</span>
                            <div className="text-center">
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
                              <StatusChip status={job.status} />
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}/qc`)}
                                className="h-7 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-semibold gap-1 px-2.5"
                              >
                                <ClipboardCheck className="h-3 w-3" /> QC
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                                className="h-7 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5"
                              >
                                ใบงาน <ExternalLink className="h-3 w-3" />
                              </Button>
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
                            className={`flex items-center gap-4 px-12 py-2 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            } hover:bg-red-50/20 transition-colors`}
                          >
                            <JobThumbnail
                              job={job}
                              size={48}
                              onPreview={(a, atts) => setPreview({ url: a.file_url, name: a.file_name, attachments: atts })}
                            />
                            <span className="font-mono text-xs font-semibold text-gray-700 w-40 shrink-0">{job.job_code}</span>
                            <span className="text-xs text-gray-500 flex-1 truncate">{job.drawing_name}</span>
                            <StatusChip status={job.status} />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}/qc`)}
                              className="h-7 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-semibold gap-1 px-2.5"
                            >
                              <ClipboardCheck className="h-3 w-3" /> QC
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                              className="h-7 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2.5"
                            >
                              ใบงาน <ExternalLink className="h-3 w-3" />
                            </Button>
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

      <AddJobDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        parentId={parentId}
        onSuccess={loadJobs}
      />

      {preview && (
        <FilePreviewDialog
          open={!!preview}
          onOpenChange={(v) => { if (!v) setPreview(null) }}
          fileUrl={preview.url}
          fileName={preview.name}
          attachments={preview.attachments}
        />
      )}
    </div>
  )
}
