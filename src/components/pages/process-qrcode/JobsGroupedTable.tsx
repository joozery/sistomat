'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ChevronDown,
  ChevronRight,
  Search,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  QrCode,
} from 'lucide-react'

interface ProcessEntry {
  process: string
  person: string
  time_hours: number
}

export interface Job {
  _id?: string
  seq: number
  date: string
  job_code: string
  parent_job: string
  drawing_name: string
  quantity: number
  completed: number
  remaining: number
  status: string
  processes: ProcessEntry[]
  total_time: number
  outsource_process: string
  coating: string
  due_date: string
  actual_completion_date: string
  kpi: string
  remark: string
  sheet_name: string
}

interface JobsGroupedTableProps {
  jobs: Job[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onOpenAddDialog: () => void
  onOpenImportDialog: () => void
}

function formatDate(d: string) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return d
  }
}

function StatusBadge({ status, kpi }: { status: string; kpi: string }) {
  if (status === 'ครบ' || status === 'รับแล้ว') {
    return (
      <Badge className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" /> {status}
      </Badge>
    )
  }
  if (status) {
    return (
      <Badge className="rounded-full px-2 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 gap-1">
        <Clock className="h-2.5 w-2.5" /> {status}
      </Badge>
    )
  }
  return null
}

function KpiBadge({ kpi }: { kpi: string }) {
  if (!kpi) return null
  const late = kpi.includes('ล่าช้า') || kpi.includes('เกิน')
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${late ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>
      {kpi}
    </span>
  )
}

export function JobsGroupedTable({
  jobs,
  loading,
  search,
  onSearchChange,
  onOpenAddDialog,
  onOpenImportDialog,
}: JobsGroupedTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Group and filter
  const grouped: Record<string, Job[]> = {}
  for (const job of jobs) {
    const key = job.parent_job
    if (
      search &&
      !key.toLowerCase().includes(search.toLowerCase()) &&
      !job.job_code.toLowerCase().includes(search.toLowerCase()) &&
      !job.drawing_name.toLowerCase().includes(search.toLowerCase())
    )
      continue
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(job)
  }

  const parentJobs = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="rounded-xl border border-gray-200/70 bg-white overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหา JOB หลัก, JOB code, ชื่อแบบ..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-full border-gray-200 bg-white text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onOpenImportDialog}
            variant="outline"
            className="gap-2 rounded-full h-10 border-gray-200 text-gray-600 hover:border-[#7B1A1A] hover:text-[#7B1A1A] px-4 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            นำเข้า Excel
          </Button>
          <Button
            onClick={onOpenAddDialog}
            className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 text-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มกระบวนการ
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7B1A1A] border-t-transparent" />
        </div>
      ) : parentJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Layers className="h-8 w-8 opacity-30" />
          <p className="text-sm">ยังไม่มีข้อมูล JOB — กด &quot;นำเข้า Excel&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {parentJobs.map(([parentJob, items]) => {
            const isOpen = expanded.has(parentJob)
            const doneCount = items.filter((j) => j.status === 'ครบ' || j.status === 'รับแล้ว').length
            const totalQty = items.reduce((s, j) => s + (j.quantity || 0), 0)
            const processes = [...new Set(items.flatMap((j) => j.processes.map((p) => p.process)).filter(Boolean))]
            const earliestDue = items
              .map((j) => j.due_date)
              .filter(Boolean)
              .sort()[0]
            const sheet = items[0]?.sheet_name

            return (
              <div key={parentJob}>
                {/* Parent row */}
                <button
                  onClick={() => toggle(parentJob)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors text-left group"
                >
                  <div className="text-gray-400 shrink-0">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>

                  {/* JOB หลัก */}
                  <div className="w-28 shrink-0">
                    <span className="font-mono font-bold text-sm text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
                      {parentJob}
                    </span>
                  </div>

                  {/* Count + progress */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 font-medium">{items.length} รายการ</span>
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400">{doneCount}/{items.length}</span>
                  </div>

                  {/* Qty */}
                  <div className="hidden md:flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <QrCode className="h-3.5 w-3.5 text-gray-300" />
                    {totalQty} ชิ้น
                  </div>

                  {/* Processes chips */}
                  <div className="hidden lg:flex gap-1.5 flex-wrap flex-1">
                    {processes.slice(0, 4).map((p) => (
                      <span key={p} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                        {p}
                      </span>
                    ))}
                    {processes.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{processes.length - 4}</span>
                    )}
                  </div>

                  {/* Due date + sheet */}
                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {earliestDue && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(earliestDue)}
                      </div>
                    )}
                    {sheet && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {sheet}
                      </span>
                    )}
                  </div>
                </button>

                {/* Sub-jobs */}
                {isOpen && (
                  <div className="bg-gray-50/40 border-t border-gray-100">
                    {/* Sub-header */}
                    <div className="grid grid-cols-[2fr_3fr_auto_auto_auto_auto] gap-4 px-10 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <span>JOB Code</span>
                      <span>ชื่อแบบ</span>
                      <span className="text-center">จำนวน</span>
                      <span>Process</span>
                      <span>กำหนดส่ง</span>
                      <span>สถานะ</span>
                    </div>

                    {items.map((job, idx) => (
                      <div
                        key={job.job_code}
                        className={`grid grid-cols-[2fr_3fr_auto_auto_auto_auto] gap-4 px-10 py-2.5 items-center text-sm ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        } hover:bg-red-50/20 transition-colors`}
                      >
                        {/* JOB code */}
                        <span className="font-mono text-xs font-semibold text-gray-700 truncate">
                          {job.job_code}
                        </span>

                        {/* Drawing name */}
                        <span className="text-xs text-gray-500 truncate" title={job.drawing_name}>
                          {job.drawing_name || '-'}
                        </span>

                        {/* Qty */}
                        <div className="text-center">
                          <span className="text-xs font-bold text-gray-700">{job.quantity}</span>
                          {job.completed > 0 && job.completed < job.quantity && (
                            <span className="text-[10px] text-gray-400 ml-1">({job.completed}✓)</span>
                          )}
                        </div>

                        {/* Processes */}
                        <div className="flex gap-1 flex-wrap">
                          {job.processes.slice(0, 2).map((p, i) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {p.process}
                            </span>
                          ))}
                          {job.processes.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{job.processes.length - 2}</span>
                          )}
                          {job.coating && (
                            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">
                              {job.coating}
                            </span>
                          )}
                        </div>

                        {/* Due date */}
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                          {formatDate(job.due_date)}
                        </span>

                        {/* Status */}
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={job.status} kpi={job.kpi} />
                          {job.kpi && <KpiBadge kpi={job.kpi} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer summary */}
      {!loading && parentJobs.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-6 py-3">
          <p className="text-xs text-gray-500">
            JOB หลัก <span className="font-bold text-gray-800">{parentJobs.length}</span> รายการ ·
            Sub-job ทั้งหมด <span className="font-bold text-gray-800">{jobs.length}</span> รายการ
          </p>
        </div>
      )}
    </div>
  )
}
