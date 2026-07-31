'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { JobHeader } from '@/components/pages/process-details/JobHeader'
import { ProcessTable, type ProcessRow } from '@/components/pages/process-details/ProcessTable'

interface ProjectData {
  project_id: string
  received_date: string
  due_date: string
  status: string
  processes?: ProcessRow[]
}

function formatThaiDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export default function ProcessDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processList, setProcessList] = useState<ProcessRow[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Fetch project from MongoDB
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (cancelled) return
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.message ?? (res.status === 404 ? `ไม่พบใบงาน "${id}"` : 'เกิดข้อผิดพลาด'))
          setLoading(false)
          return
        }
        const data: ProjectData = await res.json()
        if (cancelled) return
        setProject(data)
        setProcessList(data.processes ?? [])
      } catch {
        if (!cancelled) setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Real-time elapsed timer for running processes
  const updateElapsedTime = useCallback(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    setProcessList((prev) =>
      prev.map((row) => {
        if (!row.start_time || row.stop_time) return row
        const start = new Date(`${todayStr}T${row.start_time}:00`)
        const totalSecs = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000))
        const hrs  = Math.floor(totalSecs / 3600)
        const mins = Math.floor((totalSecs % 3600) / 60)
        const secs = totalSecs % 60
        return {
          ...row,
          elapsed_time: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
        }
      })
    )
  }, [])

  useEffect(() => {
    const interval = setInterval(updateElapsedTime, 1000)
    return () => clearInterval(interval)
  }, [updateElapsedTime])

  const handleChange = (index: number, field: keyof ProcessRow, value: string) => {
    setProcessList((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddRow = () => {
    setProcessList((prev) => [
      ...prev,
      {
        id: Date.now(),
        process: 'MATERAIL',
        target_time: '00:30',
        worker_id: '',
        start_time: '',
        stop_time: '',
        elapsed_time: '00:00',
        remark: '-',
      },
    ])
  }

  const handleDeleteRow = (index: number) => {
    setProcessList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaveState('saving')
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ processes: processList }),
      })
      if (res.ok) {
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 3000)
      } else {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      }
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-[#c62828]" />
        <p className="text-sm text-gray-500">กำลังโหลดข้อมูลใบงาน <span className="font-semibold text-gray-700">{id}</span>...</p>
      </div>
    )
  }

  // ── Not Found / Error ──
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4 font-sans">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="h-8 w-8 text-[#c62828]" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-gray-800">{error ?? 'ไม่พบข้อมูลใบงาน'}</p>
          <p className="text-xs text-gray-400 mt-1">ตรวจสอบว่าเลขที่ใบงานถูกต้อง หรือมีข้อมูลในระบบแล้ว</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="gap-2 rounded-full border-gray-200 text-gray-700 h-9 px-5 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          ย้อนกลับ
        </Button>
      </div>
    )
  }

  // ── Main ──
  return (
    <div className="space-y-6 font-sans">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="gap-2 rounded-full border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-semibold h-9 px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          ย้อนกลับ
        </Button>

        <div className="flex items-center gap-3">
          {saveState === 'success' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold animate-in fade-in-0">
              <CheckCircle2 className="h-4 w-4" />
              บันทึกข้อมูลสำเร็จ
            </div>
          )}
          {saveState === 'error' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-[#c62828] border border-red-200 text-xs font-semibold animate-in fade-in-0">
              <AlertCircle className="h-4 w-4" />
              บันทึกไม่สำเร็จ กรุณาลองใหม่
            </div>
          )}
          <span className="text-[11px] text-gray-400 hidden sm:block">
            สถานะ: <span className="font-semibold text-gray-600">{project.status}</span>
          </span>
        </div>
      </div>

      {/* Job Header */}
      <JobHeader
        id={project.project_id}
        receivedDate={formatThaiDate(project.received_date)}
        dueDate={formatThaiDate(project.due_date)}
      />

      {/* Process Table */}
      <ProcessTable
        processList={processList}
        onChange={handleChange}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
      />

      {/* Bottom Save */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="gap-2 rounded-full h-11 bg-[#c62828] hover:bg-[#b71c1c] text-white px-8 text-sm font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-70"
        >
          {saveState === 'saving'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          {saveState === 'saving' ? 'กำลังบันทึก...' : 'บันทึกข้อมูลใบงาน'}
        </Button>
      </div>
    </div>
  )
}
