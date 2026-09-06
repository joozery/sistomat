'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Printer, UserX, ShieldX, RotateCcw, XCircle } from 'lucide-react'
import { JobHeader } from '@/components/pages/process-details/JobHeader'
import { ProcessTable, type ProcessRow, type WorkerLog } from '@/components/pages/process-details/ProcessTable'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'
import { findWorker, findWorkerByUsername, findEligibleRowIndex, canWorkerDoProcess } from '@/lib/workers'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

function getLoggedInWorker() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const { username } = JSON.parse(atob(token.split('.')[1]))
    return findWorkerByUsername(username) ?? null
  } catch { return null }
}

type ToastType = 'success' | 'error' | 'warning'
interface Toast { id: number; type: ToastType; title: string; subtitle?: string }

function ScanToast({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const latest = toasts[toasts.length - 1]
  if (!latest) return null

  const cfg = {
    success: {
      overlay: 'bg-black/40',
      card: 'bg-emerald-950 border-emerald-700/60',
      icon: 'bg-emerald-500/20 text-emerald-300',
      title: 'text-emerald-100',
      sub: 'text-emerald-400',
      ring: 'ring-emerald-500/30',
      IconEl: CheckCircle2,
    },
    warning: {
      overlay: 'bg-black/50',
      card: 'bg-amber-950 border-amber-600/60',
      icon: 'bg-amber-500/20 text-amber-300',
      title: 'text-amber-100',
      sub: 'text-amber-400',
      ring: 'ring-amber-500/30',
      IconEl: ShieldX,
    },
    error: {
      overlay: 'bg-black/55',
      card: 'bg-red-950 border-red-700/60',
      icon: 'bg-red-500/20 text-red-300',
      title: 'text-red-100',
      sub: 'text-red-400',
      ring: 'ring-red-500/30',
      IconEl: UserX,
    },
  }[latest.type]

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${cfg.overlay} backdrop-blur-[2px]`}
      onClick={() => onDismiss(latest.id)}
    >
      <div
        className={`relative flex flex-col items-center gap-5 px-10 py-8 rounded-3xl border shadow-2xl ring-4 font-sans max-w-sm w-full mx-6 animate-in zoom-in-90 fade-in duration-200 ${cfg.card} ${cfg.ring}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ไอคอน */}
        <div className={`flex h-20 w-20 items-center justify-center rounded-full ${cfg.icon}`}>
          <cfg.IconEl className="h-10 w-10" strokeWidth={1.5} />
        </div>

        {/* ข้อความ */}
        <div className="text-center space-y-1.5">
          <p className={`text-xl font-bold leading-tight ${cfg.title}`}>{latest.title}</p>
          {latest.subtitle && (
            <p className={`text-sm leading-relaxed ${cfg.sub}`}>{latest.subtitle}</p>
          )}
        </div>

        {/* ปุ่มปิด */}
        <button
          onClick={() => onDismiss(latest.id)}
          className={`mt-1 px-8 py-2.5 rounded-full text-sm font-semibold transition-all ${cfg.icon} hover:opacity-80 active:scale-95`}
        >
          ตกลง
        </button>

        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-3xl overflow-hidden opacity-40">
          <div
            className={`h-full ${latest.type === 'success' ? 'bg-emerald-400' : latest.type === 'warning' ? 'bg-amber-400' : 'bg-red-400'} animate-[shrink_3.5s_linear_forwards]`}
          />
        </div>
      </div>
    </div>
  )
}

interface ProjectData {
  project_id: string
  dwg_name?: string
  received_date: string
  due_date: string
  status: string
  processes?: any[]
}

function formatThaiDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const processListRef = useRef<ProcessRow[]>([])
  useEffect(() => { processListRef.current = processList }, [processList])

  // Special command barcodes
  const pendingResetRef = useRef(false)
  const pendingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounterRef = useRef(0)
  const showToast = useCallback((type: ToastType, title: string, subtitle?: string) => {
    const id = ++toastCounterRef.current
    setToasts((prev) => [...prev, { id, type, title, subtitle }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

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
    const now = Date.now()
    const todayStr = new Date().toISOString().split('T')[0]
    const d = new Date(); d.setDate(d.getDate() - 1)
    const yesterdayStr = d.toISOString().split('T')[0]

    // แปลง "HH:MM" หรือ "HH:MM:SS" → ms โดยถ้าผลลัพธ์อยู่ในอนาคต ให้ใช้วันเมื่อวาน
    function parseTimeMs(t: string, refNow: number): number {
      let ms = new Date(`${todayStr}T${t}`).getTime()
      if (isNaN(ms)) return NaN
      if (ms > refNow + 60_000) ms = new Date(`${yesterdayStr}T${t}`).getTime()
      return ms
    }

    setProcessList((prev) =>
      prev.map((row) => {
        let totalSecs = 0

        row.workers?.forEach((w) => {
          if (!w.start_time) return
          const start = parseTimeMs(w.start_time, now)
          if (isNaN(start)) return
          const end = w.stop_time ? parseTimeMs(w.stop_time, now) : now
          if (!isNaN(end) && end > start) {
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
      const raw = e.detail.barcode.trim()
      const list = processListRef.current
      const rawUpper = raw.toUpperCase()

      // ── CMD_CANCEL: ลบ entry ของ logged-in worker ที่กำลัง running ──
      if (rawUpper === 'CMD_CANCEL') {
        e.preventDefault()
        const loggedWorker = getLoggedInWorker()
        if (!loggedWorker) {
          showToast('error', 'ไม่พบข้อมูลพนักงาน', 'กรุณา login ก่อน')
          return
        }
        const codeStr = String(loggedWorker.code)
        const runningRowIdx = list.findIndex((row) =>
          row.workers.some((w) => w.worker_id === codeStr && w.start_time && !w.stop_time)
        )
        if (runningRowIdx === -1) {
          showToast('warning', 'ไม่มีงานที่กำลังทำอยู่', 'ไม่พบ entry ที่จะยกเลิก')
          return
        }
        const canceledProcess = list[runningRowIdx].process
        setProcessList((prev) => {
          const next = [...prev]
          const row = { ...next[runningRowIdx] }
          row.workers = row.workers.map((w) =>
            w.worker_id === codeStr && w.start_time && !w.stop_time
              ? { worker_id: '', start_time: '', stop_time: '' }
              : w
          )
          next[runningRowIdx] = row
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: next }),
          }).catch(console.error)
          return next
        })
        showToast('success', `ยกเลิกเรียบร้อย — ${loggedWorker.name}`, `ลบ entry ออกจาก "${canceledProcess}"`)
        return
      }

      // ── CMD_RESET: ล้างพนักงานทั้งใบงาน (ต้อง scan 2 ครั้งเพื่อยืนยัน) ──
      if (rawUpper === 'CMD_RESET') {
        e.preventDefault()
        if (pendingResetRef.current) {
          if (pendingResetTimerRef.current) clearTimeout(pendingResetTimerRef.current)
          pendingResetRef.current = false
          setProcessList((prev) => {
            const next = prev.map((row) => ({
              ...row,
              workers: [
                { worker_id: '', start_time: '', stop_time: '' },
                { worker_id: '', start_time: '', stop_time: '' },
                { worker_id: '', start_time: '', stop_time: '' },
                { worker_id: '', start_time: '', stop_time: '' },
              ],
              elapsed_time: '00:00:00',
            }))
            fetch(`/api/projects/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
              body: JSON.stringify({ processes: next }),
            }).catch(console.error)
            return next
          })
          showToast('success', 'รีเซ็ตใบงานเรียบร้อย', 'ล้างข้อมูลพนักงานทุกกระบวนการแล้ว')
        } else {
          pendingResetRef.current = true
          showToast('warning', 'สแกนอีกครั้งเพื่อยืนยัน', 'การรีเซ็ตจะล้างข้อมูลพนักงานทั้งใบงาน (5 วินาที)')
          pendingResetTimerRef.current = setTimeout(() => {
            pendingResetRef.current = false
          }, 5000)
        }
        return
      }

      // ตรวจว่าเป็น QR ของใบงานนี้เอง — compare case-insensitive (scanner อาจส่ง lowercase)
      const rawLower = raw.toLowerCase()
      const idLower = id.toLowerCase()
      const isCurrentJobQR = rawLower === idLower || rawLower.startsWith(idLower + '|')

      let worker
      let rowIndex: number

      if (isCurrentJobQR) {
        // ใช้ logged-in user
        e.preventDefault()
        worker = getLoggedInWorker()
        if (!worker) {
          showToast('error', 'ไม่พบข้อมูลพนักงาน', 'username ไม่ตรงกับรหัสพนักงานในระบบ')
          return
        }
        const eligible = findEligibleRowIndex(list, String(worker.code), worker.machines)
        if (eligible.blockedByRow !== null) {
          const blockName = list[eligible.blockedByRow]?.process ?? `ลำดับที่ ${eligible.blockedByRow + 1}`
          showToast('warning', 'รอกระบวนการก่อนหน้าให้เสร็จก่อน', `"${blockName}" ยังไม่เสร็จ`)
          return
        }
        if (eligible.index === -1) {
          showToast('warning', 'ไม่มีกระบวนการที่ทำได้', 'ไม่มีสิทธิ์หรือทุกช่องเต็มแล้ว')
          return
        }
        rowIndex = eligible.index
      } else if (activeRowIndex !== null) {
        // สแกนรหัสพนักงานโดยตรง (เลือกแถวไว้แล้ว)
        e.preventDefault()
        worker = findWorker(raw)
        if (!worker) {
          showToast('error', 'ไม่พบรหัสพนักงาน', `รหัส "${raw}" ไม่มีในระบบ`)
          return
        }
        rowIndex = activeRowIndex
      } else {
        // ไม่ใช่ job QR และไม่ได้เลือกแถว → ปล่อยให้ GlobalBarcodeScanner navigate
        return
      }

      const targetRow = list[rowIndex]
      if (!canWorkerDoProcess(worker.machines, targetRow.process)) {
        showToast('warning', 'ไม่มีสิทธิ์', `${worker.name} ไม่มีสิทธิ์ในกระบวนการ "${targetRow.process}"`)
        return
      }

      const nowTime = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const workerIdStr = String(worker.code)

      setProcessList((prev) => {
        const next = [...prev]
        const row = { ...next[rowIndex] }
        const workers = [...row.workers]

        const runningIdx = workers.findIndex(
          (w) => w.worker_id === workerIdStr && w.start_time && !w.stop_time
        )

        if (runningIdx !== -1) {
          workers[runningIdx] = { ...workers[runningIdx], stop_time: nowTime }
          showToast('success', `จบงาน — ${worker!.name}`, `${targetRow.process} • ${nowTime}`)
        } else {
          const emptyIdx = workers.findIndex((w) => !w.worker_id)
          if (emptyIdx === -1) {
            showToast('error', 'ช่องพนักงานเต็ม', 'รองรับสูงสุด 4 คนต่อกระบวนการ')
            return prev
          }
          workers[emptyIdx] = { worker_id: workerIdStr, start_time: nowTime, stop_time: '' }
          showToast('success', `เริ่มงาน — ${worker!.name}`, `${targetRow.process} • ${nowTime}`)
        }

        row.workers = workers
        next[rowIndex] = row

        fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ processes: next }),
        }).catch(console.error)

        return next
      })
    }

    document.addEventListener('onBarcodeScan', handleLocalScan)
    return () => document.removeEventListener('onBarcodeScan', handleLocalScan)
  }, [activeRowIndex, id])

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
    <ScanToast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
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
          
          <ProcessTable
            processList={processList}
            activeRowIndex={activeRowIndex}
            onRowClick={(idx) => setActiveRowIndex(idx)}
            onChange={handleChange}
            onWorkerChange={handleWorkerChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />

          {/* Special Command QR Codes */}
          <div className="flex gap-4">
            <div className="flex items-center gap-4 flex-1 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-1.5">
                <QRCodeSVG value="CMD_CANCEL" size={72} bgColor="#ffffff" fgColor="#1a1a1a" />
                <span className="text-[10px] font-mono text-gray-400">CMD_CANCEL</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-gray-800">ยกเลิก entry ตัวเอง</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  สแกน QR นี้เพื่อลบการเริ่มงานของตัวเองออก<br />
                  (ใช้เมื่อสแกนเริ่มงานผิดพลาด)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1 rounded-xl border border-red-100 bg-red-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-1.5">
                <QRCodeSVG value="CMD_RESET" size={72} bgColor="#fff8f8" fgColor="#7B1A1A" />
                <span className="text-[10px] font-mono text-red-400">CMD_RESET</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <RotateCcw className="h-4 w-4 text-[#7B1A1A]" />
                  <span className="text-sm font-bold text-gray-800">เริ่มใหม่ทั้งใบงาน</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  สแกน QR นี้ 2 ครั้งเพื่อล้างข้อมูลพนักงาน<br />
                  ทุกกระบวนการในใบงานนี้ทั้งหมด
                </p>
              </div>
            </div>
          </div>
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
