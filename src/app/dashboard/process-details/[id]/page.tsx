'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Save, CheckCircle2, AlertCircle, Loader2, Printer, UserX, ShieldX, RotateCcw, XCircle, ScanBarcode, Play, Square, Ban, PackageCheck, ThumbsDown } from 'lucide-react'
import { JobHeader } from '@/components/pages/process-details/JobHeader'
import { ProcessTable, type ProcessRow, type WorkerLog } from '@/components/pages/process-details/ProcessTable'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'
import { findWorker, findWorkerByUsername, findEligibleRowIndex, canWorkerDoProcess, isRowCompleted } from '@/lib/workers'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })
const Barcoder = dynamic(() => import('react-barcode'), { ssr: false })

function CmdBarcode({ value, color, bg }: { value: string; color: string; bg: string }) {
  return (
    <Barcoder
      value={value}
      format="CODE128"
      width={2}
      height={56}
      fontSize={11}
      margin={4}
      background={bg}
      lineColor={color}
      displayValue={true}
    />
  )
}

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

function getNowFormatted(): string {
  const _d = new Date()
  return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')} ${_d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

function ActionModal({
  mode, processName, initialWorkerId,
  onConfirm, onClose,
}: {
  mode: 'start' | 'stop'
  processName: string; initialWorkerId: string;
  onConfirm: (workerId: string, workerName: string, nowTime: string) => void;
  onClose: () => void;
}) {
  const [clockDisplay, setClockDisplay] = useState('')
  const [flash, setFlash] = useState(false)
  const onConfirmRef = useRef(onConfirm)
  useEffect(() => { onConfirmRef.current = onConfirm }, [onConfirm])

  const isStop = mode === 'stop'
  const lockedWorker = useMemo(() => (initialWorkerId ? findWorker(initialWorkerId) : null), [initialWorkerId])

  useEffect(() => {
    const tick = () => setClockDisplay(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Scan → auto-confirm immediately (no button press needed)
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setFlash(true)
      setTimeout(() => setFlash(false), 300)
      const raw = (e.detail.barcode as string).trim()
      if (isStop) {
        // stop: confirm with pre-filled worker
        const wInfo = findWorker(initialWorkerId)
        onConfirmRef.current(initialWorkerId, wInfo?.name ?? initialWorkerId, getNowFormatted())
      } else {
        // start: use scanned barcode as worker identity
        const worker = findWorker(raw)
        const code = worker ? String(worker.code) : raw
        onConfirmRef.current(code, worker?.name ?? code, getNowFormatted())
      }
    }
    document.addEventListener('onBarcodeScan', handler)
    return () => document.removeEventListener('onBarcodeScan', handler)
  }, [isStop, initialWorkerId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const isStopCls = {
    scanRing: 'border-red-300 bg-red-50',
    scanIcon: 'text-red-400',
    scanPulse: 'bg-red-400/20',
    idText: 'text-red-700', sub: 'text-red-600', detail: 'text-red-400',
    btn: 'bg-red-700 hover:bg-red-800 shadow-red-500/20',
  }
  const isStartCls = {
    scanRing: 'border-emerald-300 bg-emerald-50',
    scanIcon: 'text-emerald-400',
    scanPulse: 'bg-emerald-400/20',
    idText: 'text-emerald-700', sub: 'text-emerald-600', detail: 'text-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
  }
  const cls = isStop ? isStopCls : isStartCls

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200 transition-colors ${flash ? (isStop ? 'bg-red-50' : 'bg-emerald-50') : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{processName}</span>
          <h2 className="text-lg font-bold text-gray-800 mt-1">
            {isStop ? 'บันทึกเวลาหยุดงาน' : 'บันทึกเวลาเริ่มงาน'}
          </h2>
        </div>

        {/* Clock */}
        <div className="text-center mb-5 py-4 rounded-2xl bg-gray-50 border border-gray-100">
          <p className="text-5xl font-bold tabular-nums text-gray-900 tracking-tight leading-none">{clockDisplay}</p>
          <p className="text-xs text-gray-400 mt-2">
            {new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Scan zone */}
        <div className={`rounded-2xl border-2 p-5 mb-5 text-center ${isStop ? (lockedWorker ? isStopCls.scanRing : 'border-dashed border-gray-200 bg-gray-50') : 'border-dashed border-gray-200 bg-gray-50'}`}>
          {isStop && lockedWorker ? (
            /* Stop: show who we're stopping */
            <>
              <p className={`text-2xl font-bold tabular-nums ${cls.idText}`}>{initialWorkerId}</p>
              <p className={`text-sm mt-0.5 font-medium ${cls.sub}`}>{lockedWorker.name}</p>
              <p className={`text-[10px] mt-0.5 ${cls.detail}`}>{lockedWorker.machines.join(', ')}</p>
              <p className="text-xs text-gray-400 mt-3 font-medium">สแกนบาร์โค้ดใดก็ได้เพื่อยืนยัน</p>
            </>
          ) : (
            /* Start: waiting for scan */
            <>
              <div className="relative inline-flex items-center justify-center mb-3">
                <span className={`absolute inset-0 rounded-full animate-ping opacity-40 ${cls.scanPulse}`} />
                <ScanBarcode className={`h-10 w-10 relative ${cls.scanIcon}`} />
              </div>
              <p className={`text-sm font-bold ${cls.scanIcon}`}>
                {isStop ? 'สแกนเพื่อหยุดงาน' : 'สแกนบาร์โค้ดพนักงาน'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">สแกนปุ๊บ → บันทึกทันที ไม่ต้องกดปุ่ม</p>
            </>
          )}
        </div>

        {/* Fallback button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          {isStop && (
            <button
              onClick={() => onConfirmRef.current(initialWorkerId, lockedWorker?.name ?? initialWorkerId, getNowFormatted())}
              className={`flex-1 h-11 rounded-full text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${cls.btn}`}
            >
              <Square className="h-4 w-4 fill-white" />
              หยุดงาน
            </button>
          )}
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
  const [activeWorkerSlot, setActiveWorkerSlot] = useState<{ row: number; col: number } | null>(null)
  const [actionModal, setActionModal] = useState<{ mode: 'start' | 'stop'; row: number; col: number; workerId: string; processName: string } | null>(null)
  const actionModalRef = useRef<typeof actionModal>(null)
  useEffect(() => { actionModalRef.current = actionModal }, [actionModal])
  const activeWorkerSlotRef = useRef<{ row: number; col: number } | null>(null)
  const processListRef = useRef<ProcessRow[]>([])
  useEffect(() => { processListRef.current = processList }, [processList])
  useEffect(() => { activeWorkerSlotRef.current = activeWorkerSlot }, [activeWorkerSlot])

  // Blocked workers
  const blockedCodesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    function syncBlocked() {
      fetch('/api/workers/block', { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((r) => r.json())
        .then((codes: number[]) => { blockedCodesRef.current = new Set(codes) })
        .catch(() => {})
    }
    syncBlocked()
    const iv = setInterval(syncBlocked, 5_000)
    return () => clearInterval(iv)
  }, [])

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

    // รองรับ format ใหม่ "YYYY-MM-DD HH:MM:SS" และ format เก่า "HH:MM:SS"
    function parseTimeMs(t: string, refNow: number): number {
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
        // format ใหม่ — มีวันที่ชัดเจน ไม่ต้องเดา
        return new Date(t.replace(' ', 'T')).getTime()
      }
      // format เก่า — เดาวันที่จาก context
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

          let end: number
          if (w.stop_time) {
            end = parseTimeMs(w.stop_time, now)
          } else {
            // ถ้ายังไม่มี stop_time แต่วิ่งเกิน 16 ชม. → ghost entry จาก session ก่อนหน้า → ข้ามไป
            if (now - start > 16 * 3600 * 1000) return
            end = now
          }

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

      // ── CMD_CANCEL/RESET/NEXT ทำงานได้แม้ modal เปิด ──
      // ── ถ้า modal เปิดอยู่ → modal จัดการ scan เอง ──
      const isCmd = rawUpper === 'CMD_CANCEL' || rawUpper === 'CMD_RESET' || rawUpper === 'CMD_NEXT'
        || rawUpper === 'CANCEL_FN' || rawUpper === 'FN_GOOD' || rawUpper === 'ACPT_FN'
      if (!isCmd && actionModalRef.current) {
        e.preventDefault()
        return
      }

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
        const cancelNext = [...list]
        const cancelRow = { ...cancelNext[runningRowIdx] }
        cancelRow.workers = cancelRow.workers.map((w) =>
          String(w.worker_id) === codeStr && w.start_time && !w.stop_time
            ? { worker_id: '', start_time: '', stop_time: '' }
            : w
        )
        cancelNext[runningRowIdx] = cancelRow
        setProcessList(cancelNext)
        fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ processes: cancelNext }),
        }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', 'กรุณากด "บันทึกข้อมูลใบงาน"'))
        showToast('success', `ยกเลิกเรียบร้อย — ${loggedWorker.name}`, `ลบ entry ออกจาก "${canceledProcess}"`)
        return
      }

      // ── CMD_RESET: QC ไม่ผ่าน — รีเซ็ตกระบวนการล่าสุดที่ยืนยันแล้ว + ถัดไปทั้งหมด (ต้อง scan 2 ครั้ง) ──
      if (rawUpper === 'CMD_RESET') {
        e.preventDefault()
        if (pendingResetRef.current) {
          if (pendingResetTimerRef.current) clearTimeout(pendingResetTimerRef.current)
          pendingResetRef.current = false
          const current = processListRef.current
          // ถอด next_confirmed_at ทุก process — เริ่มใหม่ตั้งแต่ process แรก ข้อมูลพนักงาน/เวลาเดิมยังอยู่ครบ
          const failedProcess = current[0]?.process ?? ''
          const next = current.map((row) => ({ ...row, next_confirmed_at: undefined }))
          setProcessList(next)
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: next }),
          }).catch(console.error)
          showToast('success', `QC ไม่ผ่าน — ปลดล็อก "${failedProcess}"`, 'เก็บเวลาเดิมไว้ — พนักงานสแกนต่อได้เลย')
        } else {
          pendingResetRef.current = true
          showToast('warning', 'สแกนอีกครั้งเพื่อยืนยัน QC ไม่ผ่าน', 'จะล้างข้อมูลกระบวนการล่าสุดและกระบวนการถัดไปทั้งหมด (5 วินาที)')
          pendingResetTimerRef.current = setTimeout(() => {
            pendingResetRef.current = false
          }, 5000)
        }
        return
      }

      // ── สถานะจบงาน: CANCEL_FN / FN_GOOD / ACPT_FN ──
      const statusMap: Record<string, { status: string; title: string; subtitle: string }> = {
        'CANCEL_FN': { status: 'ไม่รับงาน',     title: 'จบงานแต่ไม่รับงาน',  subtitle: 'บันทึกสถานะ: ไม่รับงาน' },
        'FN_GOOD':   { status: 'จบงาน',          title: 'จบงาน',              subtitle: 'บันทึกสถานะ: จบงาน' },
        'ACPT_FN':   { status: 'รับงาน',         title: 'รับงาน — จบงาน',    subtitle: 'บันทึกสถานะ: รับงาน' },
      }
      if (statusMap[rawUpper]) {
        e.preventDefault()
        const { status, title, subtitle } = statusMap[rawUpper]
        setProject((prev) => prev ? { ...prev, status } : prev)
        fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ status }),
        }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
        showToast('success', title, subtitle)
        return
      }

      // ── CMD_NEXT: ยืนยันปิดกระบวนการ — หยุดพนักงานที่ยังวิ่งทุกคน + ประทับ next_confirmed_at ──
      if (rawUpper === 'CMD_NEXT') {
        e.preventDefault()
        const nowTime = getNowFormatted()
        // หา process แรกที่มีพนักงานเริ่มงานแล้ว แต่ยังไม่ confirmed
        const targetIdx = list.findIndex(
          (row) => row.workers.some((w) => w.worker_id && w.start_time) && !row.next_confirmed_at
        )
        if (targetIdx === -1) {
          showToast('warning', 'ไม่มีกระบวนการที่รอยืนยัน', 'ทุกกระบวนการยืนยันแล้ว หรือยังไม่มีพนักงานเริ่มงาน')
          return
        }
        const targetRow = list[targetIdx]
        // หยุดพนักงานที่ยังวิ่งอยู่ทุกคน + set next_confirmed_at
        const closedWorkers = targetRow.workers.map((w) =>
          w.worker_id && w.start_time && !w.stop_time ? { ...w, stop_time: nowTime } : w
        )
        const nextList = [...list]
        nextList[targetIdx] = { ...targetRow, workers: closedWorkers, next_confirmed_at: nowTime }
        setProcessList(nextList)
        fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ processes: nextList }),
        }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
        showToast('success', `ยืนยันกระบวนการ "${targetRow.process}" แล้ว`, `เวลา ${nowTime.split(' ')[1]} — กระบวนการถัดไปเริ่มได้`)
        return
      }

      // ── WORKER SLOT: ถ้ามีช่องรหัสพนักงานที่กำลัง "รอสแกน" → fill แค่ worker_id ──
      const slot = activeWorkerSlotRef.current
      if (slot !== null) {
        e.preventDefault()
        const scannedWorker = findWorker(raw)
        if (!scannedWorker) {
          showToast('error', 'ไม่พบรหัสพนักงาน', `รหัส "${raw}" ไม่มีในระบบ`)
          setActiveWorkerSlot(null)
          return
        }
        if (blockedCodesRef.current.has(scannedWorker.code)) {
          showToast('error', `${scannedWorker.name} ถูกบล็อก`, 'ไม่สามารถสแกนงานได้ — ติดต่อผู้ดูแลระบบ')
          setActiveWorkerSlot(null)
          return
        }
        const slotProcess = list[slot.row]?.process ?? ''
        if (isRowCompleted(list[slot.row])) {
          showToast('warning', 'กระบวนการนี้ปิดแล้ว', `"${slotProcess}" ถูกยืนยัน CMD_NEXT ไปแล้ว`)
          setActiveWorkerSlot(null)
          return
        }
        if (!canWorkerDoProcess(scannedWorker.machines, slotProcess)) {
          showToast('warning', 'ไม่มีสิทธิ์', `${scannedWorker.name} ไม่มีสิทธิ์ในกระบวนการ "${slotProcess}"`)
          setActiveWorkerSlot(null)
          return
        }
        const slotBlockingRow = list.slice(0, slot.row).findIndex((r) => !isRowCompleted(r))
        if (slotBlockingRow !== -1) {
          showToast('warning', 'รอกระบวนการก่อนหน้าให้เสร็จก่อน', `"${list[slotBlockingRow].process}" ยังไม่เสร็จ`)
          setActiveWorkerSlot(null)
          return
        }
        const code = String(scannedWorker.code)
        const slotNext = processListRef.current.map((row, ri) => {
          if (ri !== slot.row) return row
          const workers = [...row.workers]
          workers[slot.col] = { ...workers[slot.col], worker_id: code }
          return { ...row, workers }
        })
        setProcessList(slotNext)
        setActiveWorkerSlot(null)
        fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ processes: slotNext }),
        }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', 'กรุณากด "บันทึกข้อมูลใบงาน"'))
        showToast('success', `รหัสพนักงาน: ${code}`, scannedWorker.name)
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
        if (blockedCodesRef.current.has(worker.code)) {
          showToast('error', `${worker.name} ถูกบล็อก`, 'ไม่สามารถสแกนงานได้ — ติดต่อผู้ดูแลระบบ')
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
        if (blockedCodesRef.current.has(worker.code)) {
          showToast('error', `${worker.name} ถูกบล็อก`, 'ไม่สามารถสแกนงานได้ — ติดต่อผู้ดูแลระบบ')
          return
        }
        rowIndex = activeRowIndex
        if (isRowCompleted(list[rowIndex])) {
          showToast('warning', 'กระบวนการนี้ปิดแล้ว', `"${list[rowIndex].process}" ถูกยืนยัน CMD_NEXT ไปแล้ว`)
          return
        }
        // sequential check: ถ้าเป็นการ START (ยังไม่มี entry ของ worker นี้ที่ running) ตรวจ row ก่อนหน้า
        const workerIdStr2 = String(worker.code)
        const isStarting = !list[rowIndex].workers.some(
          (w) => String(w.worker_id) === workerIdStr2 && w.start_time && !w.stop_time
        )
        if (isStarting) {
          const blockingRow = list.slice(0, rowIndex).findIndex((r) => !isRowCompleted(r))
          if (blockingRow !== -1) {
            showToast('warning', 'รอกระบวนการก่อนหน้าให้เสร็จก่อน', `"${list[blockingRow].process}" ยังไม่เสร็จ`)
            return
          }
        }
      } else {
        // ไม่ใช่ job QR และไม่ได้เลือกแถว → ปล่อยให้ GlobalBarcodeScanner navigate
        return
      }

      const targetRow = list[rowIndex]
      const workerIdStr = String(worker.code)
      // permission check เฉพาะ START — STOP ให้ผ่านเสมอ (worker running อยู่แล้ว ไม่ต้องเช็คใหม่)
      const isRunningNow = targetRow.workers.some(
        (w) => String(w.worker_id) === workerIdStr && w.start_time && !w.stop_time
      )
      if (!isRunningNow && !canWorkerDoProcess(worker.machines, targetRow.process)) {
        showToast('warning', 'ไม่มีสิทธิ์', `${worker.name} ไม่มีสิทธิ์ในกระบวนการ "${targetRow.process}"`)
        return
      }

      const _d = new Date()
      const nowTime = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')} ${_d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`

      // คำนวณ state ใหม่นอก setProcessList เพื่อหลีกเลี่ยง side-effect ใน updater
      const currentList = processListRef.current
      const next = [...currentList]
      const row = { ...next[rowIndex] }
      const workers = [...row.workers]

      const runningIdx = workers.findIndex(
        (w) => String(w.worker_id) === workerIdStr && w.start_time && !w.stop_time
      )

      let toastMsg: { type: ToastType; title: string; subtitle: string }

      if (runningIdx !== -1) {
        workers[runningIdx] = { ...workers[runningIdx], stop_time: nowTime }
        toastMsg = { type: 'success', title: `จบงาน — ${worker!.name}`, subtitle: `${targetRow.process} • ${nowTime}` }
      } else {
        const emptyIdx = workers.findIndex((w) => !w.worker_id)
        if (emptyIdx === -1) {
          showToast('error', 'ช่องพนักงานเต็ม', 'รองรับสูงสุด 4 คนต่อกระบวนการ')
          return
        }
        workers[emptyIdx] = { worker_id: workerIdStr, start_time: nowTime, stop_time: '' }
        toastMsg = { type: 'success', title: `เริ่มงาน — ${worker!.name}`, subtitle: `${targetRow.process} • ${nowTime}` }
      }

      row.workers = workers
      next[rowIndex] = row

      setProcessList(next)
      showToast(toastMsg.type, toastMsg.title, toastMsg.subtitle)

      fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ processes: next }),
      }).catch(() => {
        showToast('error', 'บันทึกไม่สำเร็จ', 'ข้อมูลอัปเดตในหน้าแต่ไม่ได้ save — กรุณากด "บันทึกข้อมูลใบงาน"')
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

  const handleActionFromModal = useCallback((workerId: string, workerName: string, nowTime: string) => {
    if (!actionModal) return
    const { mode, row, col, processName } = actionModal
    const current = processListRef.current

    if (mode === 'start') {
      const worker = findWorker(workerId)
      if (!worker) {
        showToast('error', 'ไม่พบรหัสพนักงาน', `รหัส "${workerId}" ไม่มีในระบบ`)
        return
      }
      const targetProcess = current[row]?.process ?? processName
      if (!canWorkerDoProcess(worker.machines, targetProcess)) {
        showToast('warning', 'ไม่มีสิทธิ์', `${workerName} ไม่มีสิทธิ์ในกระบวนการ "${targetProcess}"`)
        return
      }
      const blockingRow = current.slice(0, row).findIndex((r) => !isRowCompleted(r))
      if (blockingRow !== -1) {
        showToast('warning', 'รอกระบวนการก่อนหน้าให้เสร็จก่อน', `"${current[blockingRow].process}" ยังไม่เสร็จ`)
        return
      }
    }

    const next = current.map((r, ri) => {
      if (ri !== row) return r
      const workers = [...r.workers]
      if (mode === 'start') {
        workers[col] = { ...workers[col], worker_id: workerId, start_time: nowTime, stop_time: '' }
      } else {
        workers[col] = { ...workers[col], stop_time: nowTime }
      }
      return { ...r, workers }
    })
    setProcessList(next)
    setActionModal(null)
    const label = mode === 'start' ? 'เริ่มงาน' : 'หยุดงาน'
    showToast('success', `${label} — ${workerName}`, `${processName} • ${nowTime.split(' ')[1]}`)
    fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ processes: next }),
    }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', 'กรุณากด "บันทึกข้อมูลใบงาน"'))
  }, [actionModal, id, showToast])

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
    {actionModal && (
      <ActionModal
        mode={actionModal.mode}
        processName={actionModal.processName}
        initialWorkerId={actionModal.workerId}
        onConfirm={handleActionFromModal}
        onClose={() => setActionModal(null)}
      />
    )}
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
            activeWorkerSlot={activeWorkerSlot}
            onRowClick={(idx) => { setActiveRowIndex(idx); setActiveWorkerSlot(null) }}
            onWorkerSlotActivate={(row, col) => setActiveWorkerSlot({ row, col })}
            onStartClick={(row, col) => setActionModal({
              mode: 'start', row, col,
              workerId: processList[row]?.workers[col]?.worker_id ?? '',
              processName: processList[row]?.process ?? '',
            })}
            onStopClick={(row, col) => setActionModal({
              mode: 'stop', row, col,
              workerId: processList[row]?.workers[col]?.worker_id ?? '',
              processName: processList[row]?.process ?? '',
            })}
            onChange={handleChange}
            onWorkerChange={handleWorkerChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />

          {/* Status Barcodes */}
          <div className="flex gap-4">
            <div className="flex items-center gap-4 flex-1 rounded-xl border border-orange-100 bg-orange-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="CANCEL_FN" color="#9a3412" bg="#fff7ed" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Ban className="h-4 w-4 text-orange-700" />
                  <span className="text-sm font-bold text-gray-800">Cancel - FN</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  จบงานแต่ไม่รับงาน<br />
                  บันทึกสถานะ: <span className="font-semibold text-orange-700">ไม่รับงาน</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1 rounded-xl border border-blue-100 bg-blue-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="FN_GOOD" color="#1d4ed8" bg="#eff6ff" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-blue-700" />
                  <span className="text-sm font-bold text-gray-800">FN Good - FN</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  จบงาน<br />
                  บันทึกสถานะ: <span className="font-semibold text-blue-700">จบงาน</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1 rounded-xl border border-violet-100 bg-violet-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="ACPT_FN" color="#5b21b6" bg="#f5f3ff" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <PackageCheck className="h-4 w-4 text-violet-700" />
                  <span className="text-sm font-bold text-gray-800">Acpt - FN</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  รับงาน — จบงาน<br />
                  บันทึกสถานะ: <span className="font-semibold text-violet-700">รับงาน</span>
                </p>
              </div>
            </div>
          </div>

          {/* Special Command Barcodes */}
          <div className="flex gap-4">
            <div className="flex items-center gap-4 flex-1 rounded-xl border border-emerald-100 bg-emerald-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="CMD_NEXT" color="#047857" bg="#ecfdf5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowRight className="h-4 w-4 text-emerald-700" />
                  <span className="text-sm font-bold text-gray-800">ยืนยันจบกระบวนการ</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  สแกนเพื่อปิดกระบวนการที่กำลังทำอยู่และบันทึกเวลาจบ<br />
                  <span className="font-semibold text-emerald-700">ต้องสแกนทุกครั้ง</span> ก่อนกระบวนการถัดไปจะเริ่มได้
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="CMD_CANCEL" color="#1a1a1a" bg="#ffffff" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-gray-800">ยกเลิก entry ตัวเอง</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  สแกน Barcode นี้เพื่อลบการเริ่มงานของตัวเองออก<br />
                  (ใช้เมื่อสแกนเริ่มงานผิดพลาด)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1 rounded-xl border border-red-100 bg-red-50/40 px-5 py-4 shadow-sm/50">
              <div className="flex flex-col items-center gap-0.5">
                <CmdBarcode value="CMD_RESET" color="#7B1A1A" bg="#fff8f8" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <RotateCcw className="h-4 w-4 text-[#7B1A1A]" />
                  <span className="text-sm font-bold text-gray-800">QC ไม่ผ่าน — รีเซ็ต</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  สแกน 2 ครั้งเพื่อล้างข้อมูลกระบวนการล่าสุดที่ยืนยันแล้ว<br />
                  และกระบวนการถัดไปทั้งหมด ให้เริ่มใหม่ตั้งแต่จุดนั้น
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
