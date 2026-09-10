'use client'

import { useState, useEffect, useCallback, useRef, useMemo, type ComponentType } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Save, CheckCircle2, AlertCircle, Loader2, Printer, UserX, ShieldX, RotateCcw, XCircle, ScanBarcode, Play, Square, Ban, PackageCheck, ThumbsDown, PauseCircle, Info, X } from 'lucide-react'
import { JobHeader } from '@/components/pages/process-details/JobHeader'
import { ProcessTable, type ProcessRow, type WorkerLog } from '@/components/pages/process-details/ProcessTable'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'
import { findWorker, findWorkerByUsername, findEligibleRowIndex, canWorkerDoProcess, isRowCompleted, type WorkerData } from '@/lib/workers'
import { useWorkersList } from '@/lib/useWorkersList'
import { useProcessOptions } from '@/lib/useProcessOptions'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })
const Barcoder = dynamic(() => import('react-barcode'), { ssr: false })

function CmdBarcode({ value, color, bg, barWidth = 2, barHeight = 46 }: { value: string; color: string; bg: string; barWidth?: number; barHeight?: number }) {
  return (
    <Barcoder
      value={value}
      format="CODE128"
      width={barWidth}
      height={barHeight}
      fontSize={10}
      margin={3}
      background={bg}
      lineColor={color}
      displayValue={true}
    />
  )
}

type CommandBarcodeAccent = {
  border: string
  bg: string
  text: string
  icon: string
  barLine: string
  barBg: string
}

const COMMAND_BARCODE_ACCENTS: Record<string, CommandBarcodeAccent> = {
  violet: { border: 'border-violet-100', bg: 'bg-violet-50/40', text: 'text-violet-700', icon: 'text-violet-700', barLine: '#5b21b6', barBg: '#f5f3ff' },
  emerald: { border: 'border-emerald-100', bg: 'bg-emerald-50/40', text: 'text-emerald-700', icon: 'text-emerald-700', barLine: '#047857', barBg: '#ecfdf5' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50/50', text: 'text-amber-700', icon: 'text-amber-700', barLine: '#92400e', barBg: '#fffbeb' },
  orange: { border: 'border-orange-100', bg: 'bg-orange-50/40', text: 'text-orange-700', icon: 'text-orange-700', barLine: '#c2410c', barBg: '#fff7ed' },
  blue: { border: 'border-blue-100', bg: 'bg-blue-50/40', text: 'text-blue-700', icon: 'text-blue-700', barLine: '#1d4ed8', barBg: '#eff6ff' },
  red: { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-700', barLine: '#991b1b', barBg: '#fef2f2' },
}

type CommandBarcodeSpec = {
  value: string
  label: string
  desc: string
  status: string
  accent: keyof typeof COMMAND_BARCODE_ACCENTS
  icon: ComponentType<{ className?: string }>
  detail: string[]
}

const COMMAND_BARCODES: CommandBarcodeSpec[] = [
  {
    value: 'ACPT_FN', label: 'Acpt - FN', desc: 'รับงาน — จบงาน', status: 'รับงาน', accent: 'violet', icon: PackageCheck,
    detail: [
      'ใช้เมื่อพนักงานรับงานและทำเสร็จในขั้นตอนเดียว โดยไม่ต้องยืนยันทีละกระบวนการด้วย CMD_NEXT',
      'สแกนครั้งเดียว ระบบบันทึกสถานะโปรเจกต์เป็น "รับงาน" ทันที',
    ],
  },
  {
    value: 'CMD_NEXT', label: 'ยืนยันจบกระบวนการ', desc: 'ปิดกระบวนการที่กำลังทำ (ต้องสแกนทุกครั้ง)', status: '', accent: 'emerald', icon: ArrowRight,
    detail: [
      'ปิดกระบวนการแรกที่มีพนักงานเริ่มงานแล้วแต่ยังไม่ถูกยืนยัน',
      'หยุดเวลาพนักงานที่ยังทำงานอยู่ทุกคนในแถวนั้น แล้วประทับเวลายืนยันกระบวนการ',
      'ต้องสแกนทุกครั้งก่อนพนักงานจะเริ่มสแกนกระบวนการถัดไปได้',
    ],
  },
  {
    value: 'CMD_HOLD', label: 'HOLD — พักชั่วคราว', desc: 'พักงาน สแกนซ้ำเพื่อทำต่อ', status: '', accent: 'amber', icon: PauseCircle,
    detail: [
      'พักกระบวนการที่ยังไม่ยืนยัน (ยังไม่ผ่าน CMD_NEXT) ชั่วคราว — หยุดเวลาพนักงานที่กำลังทำงานอยู่ทุกคน',
      'ทำงานแบบสลับสถานะ (toggle): สแกน CMD_HOLD ซ้ำอีกครั้งเพื่อปลดล็อกและทำงานต่อ',
    ],
  },
  {
    value: 'CMD_REVERSE', label: 'ย้อนกลับกระบวนการ', desc: 'เลือกกระบวนการที่ต้องการย้อนกลับ', status: '', accent: 'orange', icon: RotateCcw,
    detail: [
      'ใช้เมื่อต้องการย้อนกลับไปทำกระบวนการที่ยืนยันไปแล้วใหม่ (เช่น ทำผิดขั้นตอน)',
      'ต้องมีอย่างน้อย 1 กระบวนการที่ยืนยันด้วย CMD_NEXT แล้ว ระบบจะเปิดหน้าต่างให้เลือกกระบวนการที่จะย้อนกลับ',
      'ข้อมูลเวลาที่บันทึกไว้เดิมจะยังคงอยู่ ไม่ถูกลบทิ้ง',
    ],
  },
  {
    value: 'FN_GOOD', label: 'FN Good - FN', desc: 'จบงาน', status: '', accent: 'blue', icon: CheckCircle2,
    detail: [
      'สแกนเมื่องานผลิตเสร็จสมบูรณ์แล้ว',
      'ระบบจะเด้ง popup ให้เลือกต่อว่าลูกค้า "รับงาน" (Acpt - FN) หรือ "ไม่รับงาน" (Cancel - FN) — ไม่บันทึกสถานะทันที',
    ],
  },
  {
    value: 'CMD_REJECT', label: 'REJECT — ยุติทันที', desc: 'สแกน 2 ครั้งเพื่อปิดทุกกระบวนการทันที', status: 'ยกเลิก', accent: 'red', icon: XCircle,
    detail: [
      'ใช้ยุติงานทั้งหมดทันทีในกรณีฉุกเฉิน',
      'ต้องสแกน 2 ครั้งติดกันภายใน 5 วินาทีเพื่อยืนยัน (ครั้งแรกเป็นการเตือน)',
      'เมื่อยืนยันแล้ว ระบบหยุดเวลาพนักงานที่กำลังทำงานอยู่ทุกคนในทุกกระบวนการ และเปลี่ยนสถานะโปรเจกต์เป็น "ยกเลิก"',
    ],
  },
  {
    value: 'CANCEL_FN', label: 'Cancel - FN', desc: 'จบงานแต่ไม่รับงาน', status: 'ไม่รับงาน', accent: 'orange', icon: Ban,
    detail: [
      'สแกนเมื่อจบงานแต่ไม่ได้รับงานจริง เช่น ยกเลิกงานก่อนเริ่มทำ',
      'บันทึกสถานะโปรเจกต์เป็น "ไม่รับงาน" ทันที',
    ],
  },
]

// ปกติโชว์การ์ดเหล่านี้ — พอสแกน FN_GOOD แล้วจะสลับไปโชว์ ACPT_FN / CANCEL_FN แทนชั่วคราว (ดู awaitingFinishDecision)
const PAGE_COMMAND_BARCODES = COMMAND_BARCODES.filter(
  (c) => c.value !== 'ACPT_FN' && c.value !== 'CANCEL_FN'
)
const FINISH_DECISION_BARCODES = COMMAND_BARCODES.filter(
  (c) => c.value === 'ACPT_FN' || c.value === 'CANCEL_FN'
)

// สถานะที่ปิดงานจริง (ตัดสินใจแล้ว) — ต่างจาก FN_GOOD ที่แค่ "งานเสร็จ" แต่ยังไม่รู้ผลว่าลูกค้ารับหรือไม่
const FINISH_STATUS_MAP: Record<string, { status: string; title: string; subtitle: string }> = {
  'CANCEL_FN': { status: 'ไม่รับงาน', title: 'จบงานแต่ไม่รับงาน', subtitle: 'บันทึกสถานะ: ไม่รับงาน' },
  'ACPT_FN': { status: 'รับงาน', title: 'รับงาน — จบงาน', subtitle: 'บันทึกสถานะ: รับงาน' },
}

function CommandBarcodeInfoModal({ spec, onClose }: { spec: CommandBarcodeSpec; onClose: () => void }) {
  const a = COMMAND_BARCODE_ACCENTS[spec.accent]
  const Icon = spec.icon
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border ${a.border} bg-white p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${a.icon}`} />
            <h3 className="text-sm font-bold text-gray-800">{spec.label}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {spec.detail.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-600">
              <span className={`mt-1 h-1 w-1 flex-none rounded-full ${a.icon} bg-current`} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {spec.status && (
          <p className="mt-3 text-xs text-gray-500">
            บันทึกสถานะ: <span className={`font-semibold ${a.text}`}>{spec.status}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function getLoggedInWorker(workers: WorkerData[]) {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const { username } = JSON.parse(atob(token.split('.')[1]))
    return findWorkerByUsername(username, workers) ?? null
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
  mode, processName, initialWorkerId, workers,
  onConfirm, onClose,
}: {
  mode: 'start' | 'stop'
  processName: string; initialWorkerId: string; workers: WorkerData[];
  onConfirm: (workerId: string, workerName: string, nowTime: string) => void;
  onClose: () => void;
}) {
  const [clockDisplay, setClockDisplay] = useState('')
  const [flash, setFlash] = useState(false)
  const onConfirmRef = useRef(onConfirm)
  useEffect(() => { onConfirmRef.current = onConfirm }, [onConfirm])

  const isStop = mode === 'stop'
  const lockedWorker = useMemo(() => (initialWorkerId ? findWorker(initialWorkerId, workers) : null), [initialWorkerId, workers])

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
        const wInfo = findWorker(initialWorkerId, workers)
        onConfirmRef.current(initialWorkerId, wInfo?.name ?? initialWorkerId, getNowFormatted())
      } else {
        // start: use scanned barcode as worker identity
        const worker = findWorker(raw, workers)
        const code = worker ? String(worker.code) : raw
        onConfirmRef.current(code, worker?.name ?? code, getNowFormatted())
      }
    }
    document.addEventListener('onBarcodeScan', handler)
    return () => document.removeEventListener('onBarcodeScan', handler)
  }, [isStop, initialWorkerId, workers])

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

function ReverseModal({
  processList,
  onSelect,
  onClose,
}: {
  processList: ProcessRow[]
  onSelect: (idx: number) => void
  onClose: () => void
}) {
  const confirmed = processList
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !!row.next_confirmed_at)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl px-8 py-7 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 mb-3">
            <RotateCcw className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-base font-bold text-gray-800">ย้อนกลับกระบวนการ</h2>
          <p className="text-xs text-gray-400 mt-1">เลือกกระบวนการที่ต้องการกลับมาทำใหม่</p>
        </div>

        {confirmed.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">ยังไม่มีกระบวนการที่ยืนยันแล้ว</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {confirmed.map(({ row, idx }) => (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
              >
                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-100 group-hover:bg-amber-100 text-gray-600 group-hover:text-amber-700 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{row.process}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">ยืนยันแล้วเมื่อ {row.next_confirmed_at?.slice(0, 16)}</p>
                </div>
                <RotateCcw className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-full border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors font-medium"
        >
          ยกเลิก
        </button>
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

  const { workers } = useWorkersList()
  const workersRef = useRef<WorkerData[]>([])
  useEffect(() => { workersRef.current = workers }, [workers])

  const { options: processOptions } = useProcessOptions()

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

  const [editVersion, setEditVersion] = useState(0)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const reverseModalOpenRef = useRef(false)
  useEffect(() => { reverseModalOpenRef.current = reverseModalOpen }, [reverseModalOpen])

  const [infoBarcodeValue, setInfoBarcodeValue] = useState<string | null>(null)
  const [awaitingFinishDecision, setAwaitingFinishDecision] = useState(false)

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
  const pendingRejectRef = useRef(false)
  const pendingRejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
            // ยังไม่สแกนหยุด — นับเวลาต่อไปเรื่อยๆ ไม่ว่าจะผ่านมานานแค่ไหน
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
    setEditVersion((v) => v + 1)
  }

  const applyFinishStatus = useCallback((rawKey: string) => {
    const entry = FINISH_STATUS_MAP[rawKey]
    if (!entry) return
    const { status, title, subtitle } = entry
    setAwaitingFinishDecision(false)
    setProject((prev) => prev ? { ...prev, status } : prev)
    fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status }),
    }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
    showToast('success', title, subtitle)
  }, [id, showToast])

  useEffect(() => {
    const handleLocalScan = (e: any) => {
      const raw = e.detail.barcode.trim()
      const list = processListRef.current
      const rawUpper = raw.toUpperCase()

      // ── CMD_CANCEL/RESET/NEXT ทำงานได้แม้ modal เปิด ──
      // ── ถ้า modal เปิดอยู่ → modal จัดการ scan เอง ──
      const isCmd = rawUpper === 'CMD_CANCEL' || rawUpper === 'CMD_RESET' || rawUpper === 'CMD_NEXT'
        || rawUpper === 'CANCEL_FN' || rawUpper === 'FN_GOOD' || rawUpper === 'ACPT_FN'
        || rawUpper === 'CMD_HOLD' || rawUpper === 'CMD_REVERSE' || rawUpper === 'CMD_REJECT'
      if (!isCmd && (actionModalRef.current || reverseModalOpenRef.current)) {
        e.preventDefault()
        return
      }

      // ── CMD_CANCEL: ลบ entry ของ logged-in worker ที่กำลัง running ──
      if (rawUpper === 'CMD_CANCEL') {
        e.preventDefault()
        const loggedWorker = getLoggedInWorker(workersRef.current)
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

      // ── CMD_REJECT: ยุติงานทั้งหมดทันที (ต้อง scan 2 ครั้ง) ──
      if (rawUpper === 'CMD_REJECT') {
        e.preventDefault()
        if (pendingRejectRef.current) {
          if (pendingRejectTimerRef.current) clearTimeout(pendingRejectTimerRef.current)
          pendingRejectRef.current = false
          const nowTime = getNowFormatted()
          const current = processListRef.current
          const next = current.map((row) => ({
            ...row,
            workers: row.workers.map((w) =>
              w.worker_id && w.start_time && !w.stop_time ? { ...w, stop_time: nowTime } : w
            ),
            next_confirmed_at: row.next_confirmed_at ?? nowTime,
          }))
          setProcessList(next)
          setProject((prev) => prev ? { ...prev, status: 'ยกเลิก' } : prev)
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: next, status: 'ยกเลิก' }),
          }).catch(console.error)
          showToast('error', 'REJECT — ยุติงานทั้งหมดแล้ว', 'ทุกกระบวนการถูกปิด สถานะ: ยกเลิก')
        } else {
          pendingRejectRef.current = true
          showToast('warning', 'สแกน CMD_REJECT อีกครั้งเพื่อยืนยัน', 'จะปิดทุกกระบวนการทันที เปลี่ยนสถานะเป็น "ยกเลิก" (5 วินาที)')
          pendingRejectTimerRef.current = setTimeout(() => { pendingRejectRef.current = false }, 5000)
        }
        return
      }

      // ── CMD_REVERSE: เปิด modal เลือกกระบวนการที่ต้องการย้อนกลับ ──
      if (rawUpper === 'CMD_REVERSE') {
        e.preventDefault()
        const hasConfirmed = list.some((row) => !!row.next_confirmed_at)
        if (!hasConfirmed) {
          showToast('warning', 'ยังไม่มีกระบวนการที่ยืนยันแล้ว', 'ต้องยืนยันด้วย CMD_NEXT ก่อน')
          return
        }
        setReverseModalOpen(true)
        return
      }

      // ── CMD_HOLD: หยุดพักชั่วคราว / ดำเนินการต่อ (toggle) ──
      if (rawUpper === 'CMD_HOLD') {
        e.preventDefault()
        const targetIdx = list.findIndex((row) => !row.next_confirmed_at)
        if (targetIdx === -1) {
          showToast('warning', 'ไม่มีกระบวนการที่จะ HOLD', 'ทุกกระบวนการยืนยันแล้ว')
          return
        }
        const targetRow = list[targetIdx]
        const nowTime = getNowFormatted()
        if (targetRow.on_hold) {
          // ปลดล็อก HOLD
          const nextList = [...list]
          nextList[targetIdx] = { ...targetRow, on_hold: false }
          setProcessList(nextList)
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: nextList }),
          }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
          showToast('success', `ปลดล็อก HOLD — "${targetRow.process}"`, 'พนักงานสแกนต่อได้เลย')
        } else {
          // เข้าสู่ HOLD — หยุดพนักงานที่ running ทุกคน
          const stoppedWorkers = targetRow.workers.map((w) =>
            w.worker_id && w.start_time && !w.stop_time ? { ...w, stop_time: nowTime } : w
          )
          const nextList = [...list]
          nextList[targetIdx] = { ...targetRow, workers: stoppedWorkers, on_hold: true }
          setProcessList(nextList)
          fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ processes: nextList }),
          }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
          showToast('warning', `HOLD — "${targetRow.process}"`, 'หยุดพักชั่วคราว สแกน CMD_HOLD อีกครั้งเพื่อดำเนินการต่อ')
        }
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
      // FN_GOOD = งานผลิตเสร็จแล้ว แต่ยังไม่รู้ว่าลูกค้าจะรับงานหรือไม่ → สลับการ์ดบาร์โค้ดด้านล่างเป็น ACPT_FN / CANCEL_FN แทนการปิดสถานะทันที (ไม่มี popup)
      if (rawUpper === 'FN_GOOD') {
        e.preventDefault()
        setAwaitingFinishDecision(true)
        return
      }
      if (FINISH_STATUS_MAP[rawUpper]) {
        e.preventDefault()
        applyFinishStatus(rawUpper)
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
        const scannedWorker = findWorker(raw, workersRef.current)
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
        if (list[slot.row]?.on_hold) {
          showToast('warning', 'กระบวนการนี้ถูก HOLD ชั่วคราว', 'สแกน CMD_HOLD อีกครั้งเพื่อดำเนินการต่อ')
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
        worker = getLoggedInWorker(workersRef.current)
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
        worker = findWorker(raw, workersRef.current)
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
      if (!isRunningNow && targetRow.on_hold) {
        showToast('warning', 'กระบวนการนี้ถูก HOLD ชั่วคราว', 'สแกน CMD_HOLD อีกครั้งเพื่อดำเนินการต่อ')
        return
      }
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
  }, [activeRowIndex, id, applyFinishStatus])

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
        overtime_grace: '',
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
    setEditVersion((v) => v + 1)
  }

  const handleDeleteRow = (index: number) => {
    setProcessList((prev) => prev.filter((_, i) => i !== index))
    setEditVersion((v) => v + 1)
  }

  const handleActionFromModal = useCallback((workerId: string, workerName: string, nowTime: string) => {
    if (!actionModal) return
    const { mode, row, col, processName } = actionModal
    const current = processListRef.current

    if (mode === 'start') {
      const worker = findWorker(workerId, workersRef.current)
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

  const handleReverse = useCallback((idx: number) => {
    setReverseModalOpen(false)
    const current = processListRef.current
    const targetProcessName = current[idx]?.process ?? `ลำดับที่ ${idx + 1}`
    const next = current.map((row, ri) =>
      ri >= idx ? { ...row, next_confirmed_at: undefined } : row
    )
    setProcessList(next)
    fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ processes: next }),
    }).catch(() => showToast('error', 'บันทึกไม่สำเร็จ', ''))
    showToast('success', `ย้อนกลับไป "${targetProcessName}" แล้ว`, 'สแกน QR ใบงานหรือรหัสพนักงานเพื่อเริ่มงาน')
  }, [id, showToast])

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

  // Auto-save: debounce 1.5s after user edits (editVersion increments in handleChange/handleAddRow/handleDeleteRow only, NOT from elapsed timer)
  useEffect(() => {
    if (editVersion === 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(processListRef.current)
    }, 1500)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVersion])

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
        workers={workers}
        onConfirm={handleActionFromModal}
        onClose={() => setActionModal(null)}
      />
    )}
    {reverseModalOpen && (
      <ReverseModal
        processList={processList}
        onSelect={handleReverse}
        onClose={() => setReverseModalOpen(false)}
      />
    )}
    {infoBarcodeValue && (() => {
      const spec = COMMAND_BARCODES.find((c) => c.value === infoBarcodeValue)
      return spec ? <CommandBarcodeInfoModal spec={spec} onClose={() => setInfoBarcodeValue(null)} /> : null
    })()}
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
            processOptions={processOptions}
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

          {/* Command Barcodes: ปกติโชว์ workflow ทั่วไป — พอสแกน FN_GOOD แล้วสลับมาโชว์ ACPT_FN / CANCEL_FN แทนชั่วคราว */}
          {awaitingFinishDecision && (
            <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2.5">
              <p className="text-xs font-medium text-blue-800">
                งานผลิตเสร็จแล้ว — สแกน <span className="font-bold">Acpt-FN</span> ถ้าลูกค้ารับงาน หรือ <span className="font-bold">Cancel-FN</span> ถ้าไม่รับงาน
              </p>
              <button
                type="button"
                onClick={() => setAwaitingFinishDecision(false)}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                ยกเลิก
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(awaitingFinishDecision ? FINISH_DECISION_BARCODES : PAGE_COMMAND_BARCODES).map(({ value, label, desc, status, accent, icon: Icon }) => {
              const a = COMMAND_BARCODE_ACCENTS[accent]
              return (
                <div
                  key={value}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border ${a.border} ${a.bg} px-3 py-3 text-center`}
                >
                  <button
                    type="button"
                    onClick={() => setInfoBarcodeValue(value)}
                    aria-label={`วิธีใช้งาน ${label}`}
                    className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-gray-400 hover:bg-white/70 hover:text-gray-600"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${a.icon}`} />
                    <span className="text-xs font-semibold text-gray-800">{label}</span>
                  </div>
                  <CmdBarcode value={value} color={a.barLine} bg={a.barBg} />
                  <p className="text-[11px] leading-snug text-gray-500">
                    {desc}
                    {status && (
                      <>
                        {' · '}
                        <span className={`font-medium ${a.text}`}>{status}</span>
                      </>
                    )}
                  </p>
                </div>
              )
            })}
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
