'use client'

import { useState, useEffect, useCallback } from 'react'
import { QrCode, Activity, CheckCircle2 } from 'lucide-react'
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

const demoProjects: Project[] = [
  { project_id: 'PRJ-2025-081', received_date: '2025-07-28', due_date: '2025-08-05' },
  { project_id: 'PRJ-2025-082', received_date: '2025-07-29', due_date: '2025-08-06' },
  { project_id: 'PRJ-2025-083', received_date: '2025-07-30', due_date: '2025-08-07' },
  { project_id: 'PRJ-2025-084', received_date: '2025-07-31', due_date: '2025-08-08' },
  { project_id: 'PRJ-2025-085', received_date: '2025-07-31', due_date: '2025-08-09' },
]

export default function ProcessQRCodePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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

  const filtered = projects.filter((p) =>
    p.project_id.toLowerCase().includes(search.toLowerCase())
  )
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

      <ProjectTable
        projects={paginated}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        filteredCount={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        search={search}
        onSearchChange={setSearch}
        onOpenAddDialog={() => setDialogOpen(true)}
        onOpenImportDialog={() => setImportOpen(true)}
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
