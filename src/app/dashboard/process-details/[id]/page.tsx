'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Printer } from 'lucide-react'
import { JobHeader } from '@/components/pages/process-details/JobHeader'
import { ProcessTable, type ProcessRow, type WorkerLog } from '@/components/pages/process-details/ProcessTable'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'

interface ProjectData {
  project_id: string
  dwg_name?: string
  received_date: string
  due_date: string
  status: string
  processes?: any[]
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
  
  // Scanner states
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)
  const [activeWorkerId, setActiveWorkerId] = useState<string>('')

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
        
        // Migrate legacy data and format workers array
        const mappedProcesses = (data.processes ?? []).map((p: any) => {
          let workers = p.workers || []
          if (!p.workers && p.worker_id !== undefined) {
            workers = [
              { worker_id: p.worker_id || '', start_time: p.start_time || '', stop_time: p.stop_time || '' }
            ]
          }
          while (workers.length < 4) {
            workers.push({ worker_id: '', start_time: '', stop_time: '' })
          }
          return {
            ...p,
            skill: p.skill || '0',
            workers: workers.slice(0, 4)
          }
        })
        setProcessList(mappedProcesses)
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
        let totalSecs = 0
        let isRunning = false

        row.workers?.forEach((w) => {
          if (!w.start_time) return
          const start = new Date(`${todayStr}T${w.start_time}:00`).getTime()
          let end = Date.now()
          if (w.stop_time) {
            end = new Date(`${todayStr}T${w.stop_time}:00`).getTime()
          } else {
            isRunning = true
          }
          if (end > start) {
            totalSecs += Math.floor((end - start) / 1000)
          }
        })

        const hrs  = Math.floor(totalSecs / 3600)
        const mins = Math.floor((totalSecs % 3600) / 60)
        const secs = totalSecs % 60
        const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

        if (row.elapsed_time === formatted) return row

        return {
          ...row,
          elapsed_time: formatted,
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

  useEffect(() => {
    const handleLocalScan = (e: any) => {
      if (activeRowIndex === null) return
      
      // Stop GlobalBarcodeScanner from navigating
      e.preventDefault()

      const raw = e.detail.barcode.toUpperCase()
      const isCommand = ['START', 'STOP', 'FN', 'PASS', 'NG', 'REJ'].includes(raw)
      
      if (isCommand) {
        if (!activeWorkerId) {
          alert('กรุณาสแกนรหัสพนักงานก่อนทำรายการ!')
          return
        }
        
        setProcessList(prev => {
          const next = [...prev]
          const row = { ...next[activeRowIndex] }
          const workers = [...row.workers]
          
          const nowTime = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' })
          
          if (raw === 'START') {
             // Find slot for worker
             let slotIdx = workers.findIndex(w => w.worker_id === activeWorkerId && !w.stop_time)
             if (slotIdx === -1) slotIdx = workers.findIndex(w => !w.worker_id)
             
             if (slotIdx !== -1) {
                workers[slotIdx] = { worker_id: activeWorkerId, start_time: nowTime, stop_time: '' }
             } else {
                alert('ช่องพนักงานเต็มแล้ว!')
                return prev
             }
          } else if (raw === 'STOP' || raw === 'FN') {
             const slotIdx = workers.findIndex(w => w.worker_id === activeWorkerId && w.start_time && !w.stop_time)
             if (slotIdx !== -1) {
                workers[slotIdx] = { ...workers[slotIdx], stop_time: nowTime }
             } else {
                alert('ไม่พบการเริ่มงานของพนักงานนี้')
                return prev
             }
          }
          
          row.workers = workers
          next[activeRowIndex] = row

          // Auto-save silently so the worker can walk away immediately
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: next }),
          }).catch(console.error)

          return next
        })
        
        setActiveWorkerId('') // reset after action
      } else {
        // Assume raw string is Worker ID
        setActiveWorkerId(raw)
      }
    }
    
    document.addEventListener('onBarcodeScan', handleLocalScan)
    return () => document.removeEventListener('onBarcodeScan', handleLocalScan)
  }, [activeRowIndex, activeWorkerId])

  const handleWorkerChange = (index: number, workerIndex: number, field: keyof WorkerLog, value: string) => {
    setProcessList((prev) => {
      const next = [...prev]
      const nextWorkers = [...next[index].workers]
      nextWorkers[workerIndex] = { ...nextWorkers[workerIndex], [field]: value }
      next[index] = { ...next[index], workers: nextWorkers }
      return next
    })
  }

  const handleAddRow = () => {
    setProcessList((prev) => [
      ...prev,
      {
        id: Date.now(),
        process: 'MATERAIL',
        target_time: '00:00',
        skill: '0',
        workers: [
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
        ],
        elapsed_time: '00:00:00',
        remark: '',
      },
    ])
  }

  const handleDeleteRow = (index: number) => {
    setProcessList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (processesToSave?: ProcessRow[]) => {
    setSaveState('saving')
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ processes: processesToSave || processList }),
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
        <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
        <p className="text-sm text-gray-500">กำลังโหลดข้อมูลใบงาน <span className="font-semibold text-gray-700">{id}</span>...</p>
      </div>
    )
  }

  // ── Not Found / Error ──
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4 font-sans">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="h-8 w-8 text-[#7B1A1A]" />
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
    <>
    <div className="space-y-6 font-sans print:hidden">
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-[#7B1A1A] border border-red-200 text-xs font-semibold animate-in fade-in-0">
              <AlertCircle className="h-4 w-4" />
              บันทึกไม่สำเร็จ กรุณาลองใหม่
            </div>
          )}
          <span className="text-[11px] text-gray-400 hidden sm:block">
            สถานะ: <span className="font-semibold text-gray-600">{project.status}</span>
          </span>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <JobHeader
            id={project.project_id}
            dwgName={project.dwg_name}
            receivedDate={formatThaiDate(project.received_date)}
            dueDate={formatThaiDate(project.due_date)}
          />
          
          {/* Scanner Help Box */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h3 className="font-bold text-blue-900 mb-1 flex items-center gap-2">
                <span className="text-xl">📷</span> ระบบสแกนบาร์โค้ดเริ่มงาน / จบงาน
              </h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                1. <b>คลิกเลือก</b> แถวกระบวนการผลิตที่ต้องการทำ (แถวจะกลายเป็นสีฟ้า)<br/>
                2. <b>สแกนรหัสพนักงาน</b> เพื่อยืนยันตัวตน {activeWorkerId && <span className="inline-block bg-green-500 text-white px-2 py-0.5 rounded text-xs ml-2 animate-pulse">พนักงานที่เลือก: {activeWorkerId}</span>}<br/>
                3. <b>สแกนสถานะ</b> (START / STOP / FN) เพื่อบันทึกเวลาอัตโนมัติ
              </p>
            </div>
            {/* กล่องทดสอบ (สำหรับ Dev) */}
            <div className="bg-white p-3 rounded border border-blue-200 shadow-sm text-xs w-full sm:w-auto">
              <span className="font-bold text-blue-800 block mb-1">กล่องทดสอบจำลองบาร์โค้ด</span>
              <form onSubmit={(e) => {
                e.preventDefault()
                const val = (e.currentTarget.elements.namedItem('barcode') as HTMLInputElement).value
                if (val) {
                  document.dispatchEvent(new CustomEvent('onBarcodeScan', { detail: { barcode: val }, cancelable: true }))
                  ;(e.currentTarget.elements.namedItem('barcode') as HTMLInputElement).value = ''
                }
              }} className="flex gap-2">
                <input name="barcode" type="text" placeholder="EMP001, START..." className="border border-gray-300 rounded px-2 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button type="submit" className="bg-blue-600 text-white px-3 rounded font-semibold hover:bg-blue-700 h-8">ยิง!</button>
              </form>
            </div>
          </div>

          <ProcessTable
            processList={processList}
            activeRowIndex={activeRowIndex}
            onRowClick={(idx) => setActiveRowIndex(idx)}
            onChange={handleChange}
            onWorkerChange={handleWorkerChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex justify-between items-center pt-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/process-details/${id}/print`)}
          className="gap-2 rounded-full h-11 border-gray-200 text-gray-700 hover:bg-gray-50 px-6 text-sm font-semibold"
        >
          <Printer className="h-4 w-4" />
          ปริ้นใบงาน
        </Button>

        <Button
          onClick={() => handleSave()}
          disabled={saveState === 'saving'}
          className="gap-2 rounded-full h-11 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-8 text-sm font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-70"
        >
          {saveState === 'saving'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          {saveState === 'saving' ? 'กำลังบันทึก...' : 'บันทึกข้อมูลใบงาน'}
        </Button>
      </div>
    </div>

    {/* Print Area — hidden on screen, visible only when printing */}
    <PrintJobSheet
      jobId={project.project_id}
      dwgName={project.dwg_name}
      receivedDate={formatThaiDate(project.received_date)}
      dueDate={formatThaiDate(project.due_date)}
      processList={processList}
    />
  </>
  )
}
