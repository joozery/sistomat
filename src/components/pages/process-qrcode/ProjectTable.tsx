'use client'

import { useRouter } from 'next/navigation'
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
import { Loader2, ExternalLink, Search, Plus, Clock, Calendar, CheckCircle2, QrCode } from 'lucide-react'

interface Project {
  project_id: string
  received_date: string
  due_date: string
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
  { step: 'QC & Inspection', bg: 'bg-[#c62828] text-white' },
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
}: ProjectTableProps) {
  const router = useRouter()

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
            className="pl-10 h-10 rounded-full border-gray-200 bg-white text-sm focus:border-[#c62828] transition-all"
          />
        </div>

        <Button
          onClick={onOpenAddDialog}
          className="gap-2 rounded-full h-10 bg-[#c62828] hover:bg-[#b71c1c] text-white px-5 shadow-sm transition-all shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มกระบวนการ</span>
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#c62828]" />
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
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-28">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <QrCode className="h-6 w-6 opacity-30" />
                      <p className="text-sm">ไม่พบโปรเจคที่ค้นหา</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project, index) => {
                  const stepObj = processSteps[index % processSteps.length]

                  return (
                    <TableRow key={project.project_id} className="hover:bg-red-50/20 transition-colors group">
                      <TableCell className="text-xs font-bold text-gray-400 text-center">
                        {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-gray-800 group-hover:text-[#c62828] transition-colors">
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

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full text-[#c62828] hover:bg-red-50 hover:text-[#b71c1c] text-xs font-semibold gap-1"
                          onClick={() => router.push(`/dashboard/process-details/${project.project_id}`)}
                        >
                          <span>ดูรายละเอียด</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
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
                      currentPage === p ? 'bg-[#c62828] hover:bg-[#b71c1c] text-white border-none' : ''
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
    </div>
  )
}
