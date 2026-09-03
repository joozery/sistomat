'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, ExternalLink, Search, Plus, Clock, Calendar, CheckCircle2, QrCode, FileSpreadsheet, Paperclip, Trash2, AlertTriangle } from 'lucide-react'
import { FilePreviewDialog } from './FilePreviewDialog'
import { FileThumbnail } from './FileThumbnail'

interface Project {
  project_id: string
  received_date: string
  due_date: string
  file_url?: string
  file_name?: string
}

interface MatchedJob {
  job_code: string
  level1?: string
  drawing_name?: string
  quantity?: number
  status?: string
}

interface ProjectTableProps {
  projects: Project[]
  loading: boolean
  currentPage: number
  totalPages: number
  filteredCount: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  search: string
  onSearchChange: (value: string) => void
  onOpenAddDialog: () => void
  onOpenImportDialog: () => void
  onDeleted: () => void
  matchedJobs: MatchedJob[]
}

function formatDate(dateString: string) {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

const processSteps = [
  { step: 'QC & Inspection', bg: 'bg-[#7B1A1A] text-white' },
  { step: 'LATHE 1 - กลึงชิ้นงาน', bg: 'bg-amber-600 text-white' },
  { step: 'CNC 2 - กัดชิ้นงาน', bg: 'bg-purple-600 text-white' },
  { step: 'CAM - ออกแบบทางเดิน Tool', bg: 'bg-blue-600 text-white' },
  { step: 'MAT - เบิกวัตถุดิบ', bg: 'bg-emerald-600 text-white' },
]

export function ProjectTable({
  projects,
  loading,
  currentPage,
  totalPages,
  filteredCount,
  itemsPerPage,
  onPageChange,
  search,
  onSearchChange,
  onOpenAddDialog,
  onOpenImportDialog,
  onDeleted,
  matchedJobs,
}: ProjectTableProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
      onDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200/70 bg-white overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาเลขที่โปรเจค..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-full border-gray-200 bg-white text-sm focus:border-[#7B1A1A] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onOpenImportDialog}
            variant="outline"
            className="gap-2 rounded-full h-10 border-gray-200 text-gray-600 hover:border-[#7B1A1A] hover:text-[#7B1A1A] px-4 text-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>นำเข้า Excel</span>
          </Button>
          <Button
            onClick={onOpenAddDialog}
            className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มกระบวนการ</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="hover:bg-transparent border-gray-100">
                <TableHead className="w-12 text-center text-xs font-bold text-gray-400 uppercase">#</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">เลขที่โปรเจค</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">ขั้นตอนปัจจุบัน</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">วันที่รับงาน</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">ระยะเวลาใช้งาน</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">กำหนดส่งมอบ</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase">สถานะ</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-24">Preview</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-28">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <QrCode className="h-6 w-6 opacity-30" />
                      <p className="text-sm">ไม่พบโปรเจคที่ค้นหา</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project, index) => {
                  const stepObj = processSteps[index % processSteps.length]
                  const jobsForProject = search
                    ? matchedJobs.filter(
                        (j) => j.level1 === project.project_id || j.level1 === `J${project.project_id}`
                      )
                    : []

                  return (
                  <Fragment key={project.project_id}>
                    <TableRow className="hover:bg-red-50/20 transition-colors group">
                      <TableCell className="text-xs font-bold text-gray-400 text-center">
                        {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
                            {project.project_id}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={`rounded-full px-3 py-0.5 text-xs font-semibold ${stepObj.bg}`}>
                          {stepObj.step}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-gray-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(project.received_date)}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium text-gray-700">
                          <Clock className="h-3 w-3 text-gray-400" />
                          40 นาที
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-gray-600 font-medium">
                        {formatDate(project.due_date)}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          กำลังดำเนินการ
                        </Badge>
                      </TableCell>

                      <TableCell className="py-2">
                        <div className="flex justify-center">
                          {project.file_url && project.file_name ? (
                            <FileThumbnail
                              fileUrl={project.file_url}
                              fileName={project.file_name}
                              onClick={() => setPreview({ url: project.file_url!, name: project.file_name! })}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                              <Paperclip className="h-4 w-4 text-gray-200" />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full text-[#7B1A1A] hover:bg-red-50 hover:text-[#5C1212] text-xs font-semibold gap-1"
                            onClick={() => {
                              // Excel-imported level1 already has the J prefix (e.g. JA-0298);
                              // projects created via "เพิ่มกระบวนการ" store the raw id (e.g. A-0298)
                              // and their job hierarchy lives under J + that id.
                              const isLevel1 = /^J[A-Z]-\d{3,4}$/.test(project.project_id)
                              const isRawLevel1 = /^[A-Z]-\d{3,4}$/.test(project.project_id)
                              const href = isLevel1
                                ? `/dashboard/job-list/${project.project_id}`
                                : isRawLevel1
                                ? `/dashboard/job-list/J${project.project_id}`
                                : `/dashboard/process-details/${project.project_id}`
                              router.push(href)
                            }}
                          >
                            <span>ดูรายละเอียด</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setDeleteTarget(project.project_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {jobsForProject.length > 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="bg-amber-50/40 border-l-2 border-amber-300 px-6 py-2.5">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                            Job ที่ตรงกับคำค้นหา ({jobsForProject.length})
                          </p>
                          <div className="space-y-1">
                            {jobsForProject.map((job) => (
                              <div
                                key={job.job_code}
                                className="flex items-center gap-3 text-xs bg-white rounded-lg border border-amber-100 px-3 py-1.5"
                              >
                                <span className="font-mono font-semibold text-gray-800">{job.job_code}</span>
                                {job.drawing_name && (
                                  <span className="text-gray-500 truncate flex-1">{job.drawing_name}</span>
                                )}
                                {job.quantity != null && (
                                  <span className="text-gray-400 shrink-0">{job.quantity} ชิ้น</span>
                                )}
                                {job.status && (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 shrink-0">
                                    {job.status}
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 rounded-full text-[#7B1A1A] hover:bg-red-50 text-[11px] font-semibold gap-1 px-2 shrink-0"
                                  onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(job.job_code)}`)}
                                >
                                  ใบงาน <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-100 bg-gray-50/40 px-6 py-3.5 gap-3">
            <p className="text-xs text-gray-500">
              แสดงรายการที่ <span className="font-bold text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</span>–
              <span className="font-bold text-gray-800">{Math.min(currentPage * itemsPerPage, filteredCount)}</span> จากทั้งหมด{' '}
              <span className="font-bold text-gray-800">{filteredCount}</span> รายการ
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => onPageChange(currentPage - 1)}
                  className="rounded-xl text-xs h-8"
                >
                  ก่อนหน้า
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={currentPage === p ? 'default' : 'outline'}
                    size="sm"
                    className={`w-8 h-8 rounded-xl text-xs ${
                      currentPage === p ? 'bg-[#7B1A1A] hover:bg-[#5C1212] text-white border-none' : ''
                    }`}
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => onPageChange(currentPage + 1)}
                  className="rounded-xl text-xs h-8"
                >
                  ถัดไป
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {preview && (
        <FilePreviewDialog
          open={!!preview}
          onOpenChange={(v) => { if (!v) setPreview(null) }}
          fileUrl={preview.url}
          fileName={preview.name}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError('') } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-6 bg-white border-0 font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ยืนยันการลบโปรเจค
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              ต้องการลบโปรเจค <span className="font-mono font-bold text-gray-700">{deleteTarget}</span> ใช่หรือไม่?
              การลบจะลบ Job ย่อยที่ผูกอยู่ทั้งหมดด้วย และไม่สามารถย้อนกลับได้
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
              {deleting ? 'กำลังลบ...' : 'ลบโปรเจค'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
