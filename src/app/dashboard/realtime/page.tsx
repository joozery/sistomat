'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Activity, RefreshCw, Wifi, WifiOff, Clock, User, CheckCircle2,
  Play, Search, Filter, ChevronDown, Layers, Zap, ExternalLink,
} from 'lucide-react'
import { findWorker } from '@/lib/workers'

interface RealtimeEvent {
  project_id: string
  dwg_name: string
  level1: string
  level2: string
  process: string
  status: 'running' | 'completed' | 'idle'
  worker_id: string
  start_time: string
  stop_time: string | null
  target_time: string
  skill: string
  remark: string
  job_status: string
  due_date: string
  received_date: string
}

interface RealtimeData {
  events: RealtimeEvent[]
  total: number
  running: number
  completed: number
  idle: number
  timestamp: string
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

// รองรับทั้ง "HH:MM" และ "HH:MM:SS" — ถ้าผลลัพธ์อยู่ในอนาคตให้ใช้เมื่อวาน (กรณีข้ามวัน)
function parseTime(timeStr: string, refNow = Date.now()): number {
  if (!timeStr) return NaN
  const todayStr = new Date(refNow).toISOString().split('T')[0]
  const yesterdayStr = new Date(refNow - 86400000).toISOString().split('T')[0]
  const normalized = timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr
  let ms = new Date(`${todayStr}T${normalized}`).getTime()
  if (isNaN(ms)) return NaN
  if (ms > refNow + 60_000) ms = new Date(`${yesterdayStr}T${normalized}`).getTime()
  return ms
}

function calcElapsed(start: string, stop?: string | null, now?: number): string {
  const refNow = now ?? Date.now()
  const startMs = parseTime(start, refNow)
  const endMs = stop ? parseTime(stop, refNow) : refNow
  if (isNaN(startMs) || isNaN(endMs)) return '—'
  const secs = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calcProgress(start: string, target: string, stop?: string | null, now?: number): number {
  const refNow = now ?? Date.now()
  const startMs = parseTime(start, refNow)
  const endMs = stop ? parseTime(stop, refNow) : refNow
  if (isNaN(startMs) || isNaN(endMs)) return 0
  const elapsed = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const targetParts = (target ?? '00:00').split(':').map(Number)
  const targetSecs = (targetParts[0] || 0) * 3600 + (targetParts[1] || 0) * 60
  if (!targetSecs) return 0
  return Math.min(100, Math.round((elapsed / targetSecs) * 100))
}

const PROCESS_COLORS: Record<string, string> = {
  CAM:      'bg-violet-100 text-violet-700 border-violet-200',
  CNC:      'bg-blue-100 text-blue-700 border-blue-200',
  ML:       'bg-amber-100 text-amber-700 border-amber-200',
  LATHE:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  QC:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  SPAR:     'bg-orange-100 text-orange-700 border-orange-200',
  TAP:      'bg-pink-100 text-pink-700 border-pink-200',
  MATERAIL: 'bg-stone-100 text-stone-600 border-stone-200',
  ODER:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  CUT:      'bg-rose-100 text-rose-700 border-rose-200',
}

function getProcessColor(process: string): string {
  const key = Object.keys(PROCESS_COLORS).find((k) => process.toUpperCase().includes(k))
  return key ? PROCESS_COLORS[key] : 'bg-gray-100 text-gray-600 border-gray-200'
}

function TableRow({ ev, idx, now }: { ev: RealtimeEvent; idx: number; now: number }) {
  const router = useRouter()
  const isRunning = ev.status === 'running'
  const isIdle = ev.status === 'idle'

  // คำนวณตรงๆ ทุก render — now เปลี่ยนทุกวินาที ทำให้ค่าอัปเดตแน่นอน
  const elapsed = isRunning
    ? calcElapsed(ev.start_time, null, now)
    : ev.status === 'completed' ? calcElapsed(ev.start_time, ev.stop_time, now) : null

  const progress = isRunning
    ? calcProgress(ev.start_time, ev.target_time, null, now)
    : ev.status === 'completed' ? 100 : null

  const isOvertime = isRunning && (progress ?? 0) >= 100

  return (
    <tr
      className={`group border-b border-gray-100 transition-colors cursor-pointer ${
        isRunning
          ? isOvertime ? 'bg-red-50/40 hover:bg-red-50/60' : 'bg-white hover:bg-blue-50/30'
          : isIdle ? 'bg-gray-50/20 hover:bg-gray-50/50'
          : 'bg-gray-50/30 hover:bg-gray-50/60'
      }`}
      onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(ev.project_id)}`)}
    >
      {/* # */}
      <td className="pl-5 pr-2 py-3 text-xs font-bold text-gray-300 text-center w-8">
        {String(idx + 1).padStart(2, '0')}
      </td>

      {/* สถานะ */}
      <td className="px-3 py-3 w-28">
        {isRunning ? (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            isOvertime ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-700'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOvertime ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOvertime ? 'bg-red-500' : 'bg-emerald-500'}`} />
            </span>
            {isOvertime ? 'OVERTIME' : 'LIVE'}
          </span>
        ) : isIdle ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            รอดำเนินการ
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
            <CheckCircle2 className="h-3 w-3" />
            เสร็จแล้ว
          </span>
        )}
      </td>

      {/* JOB / DWG */}
      <td className="px-3 py-3 min-w-[160px]">
        <p className="font-mono text-xs font-bold text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
          {ev.project_id}
        </p>
        {ev.dwg_name && (
          <p className="text-[11px] text-gray-400 truncate max-w-[200px] mt-0.5">{ev.dwg_name}</p>
        )}
        {ev.level1 && (
          <p className="text-[10px] text-gray-300 mt-0.5">{[ev.level1, ev.level2].filter(Boolean).join(' › ')}</p>
        )}
      </td>

      {/* Process */}
      <td className="px-3 py-3 w-40">
        {isIdle ? (
          <span className="text-[11px] text-gray-400 truncate block max-w-[150px]">{ev.process}</span>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getProcessColor(ev.process)}`}>
            <Layers className="h-3 w-3" />
            {ev.process}
          </span>
        )}
      </td>

      {/* พนักงาน */}
      <td className="px-3 py-3 w-36">
        {ev.worker_id ? (() => {
          const worker = findWorker(ev.worker_id)
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  <User className="h-3 w-3" />
                  #{ev.worker_id}
                </span>
                {ev.skill && ev.skill !== '0' && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Zap className="h-2.5 w-2.5" />
                    {ev.skill}
                  </span>
                )}
              </div>
              {worker && (
                <span className="text-[11px] text-gray-500 font-medium truncate max-w-[140px]">
                  {worker.name}
                </span>
              )}
            </div>
          )
        })() : (
          <span className="text-[11px] text-gray-300">—</span>
        )}
      </td>

      {/* เวลาเริ่ม / จบ */}
      <td className="px-3 py-3 w-28 text-xs text-gray-500 whitespace-nowrap">
        {ev.start_time ? (
          <>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-300 shrink-0" />
              {ev.start_time}
            </div>
            {ev.stop_time && (
              <div className="text-[11px] text-gray-400 mt-0.5 pl-4">→ {ev.stop_time}</div>
            )}
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Elapsed */}
      <td className="px-3 py-3 w-28">
        {elapsed ? (
          <span className={`font-mono text-sm font-bold ${isOvertime ? 'text-red-500' : isRunning ? 'text-gray-800' : 'text-gray-400'}`}>
            {elapsed}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Progress */}
      <td className="px-3 py-3 w-40">
        {progress !== null ? (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>เป้า {ev.target_time || '—'}</span>
              <span className={isOvertime ? 'text-red-500 font-semibold' : ''}>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-28">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isOvertime ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Link */}
      <td className="pr-4 py-3 w-10 text-right">
        <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#7B1A1A] transition-colors" />
      </td>
    </tr>
  )
}

function CompletedRow({ ev, idx }: { ev: RealtimeEvent; idx: number }) {
  const router = useRouter()
  return (
    <tr
      className="group border-b border-gray-100 bg-white hover:bg-blue-50/20 transition-colors cursor-pointer"
      onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(ev.project_id)}`)}
    >
      <td className="pl-5 pr-2 py-3 text-xs font-bold text-gray-300 text-center w-8">
        {String(idx + 1).padStart(2, '0')}
      </td>
      <td className="px-3 py-3 min-w-[160px]">
        <p className="font-mono text-xs font-bold text-gray-700 group-hover:text-blue-700 transition-colors">{ev.project_id}</p>
        {ev.dwg_name && <p className="text-[11px] text-gray-400 truncate max-w-[220px] mt-0.5">{ev.dwg_name}</p>}
        {ev.level1 && <p className="text-[10px] text-gray-300 mt-0.5">{[ev.level1, ev.level2].filter(Boolean).join(' › ')}</p>}
      </td>
      <td className="px-3 py-3 w-36">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getProcessColor(ev.process)}`}>
          <Layers className="h-3 w-3" />{ev.process}
        </span>
      </td>
      <td className="px-3 py-3 w-36">
        {ev.worker_id ? (() => {
          const worker = findWorker(ev.worker_id)
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 w-fit">
                <User className="h-3 w-3" />#{ev.worker_id}
              </span>
              {worker && (
                <span className="text-[11px] text-gray-500 font-medium truncate max-w-[140px]">
                  {worker.name}
                </span>
              )}
            </div>
          )
        })() : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-3 w-28 text-xs text-gray-500 whitespace-nowrap">
        {ev.start_time && (
          <>
            <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-gray-300" />{ev.start_time}</div>
            {ev.stop_time && <div className="text-[11px] text-gray-400 mt-0.5 pl-4">→ {ev.stop_time}</div>}
          </>
        )}
      </td>
      <td className="px-3 py-3 w-28">
        <span className="font-mono text-sm font-bold text-gray-400">{calcElapsed(ev.start_time, ev.stop_time)}</span>
      </td>
      <td className="pr-4 py-3 w-10 text-right">
        <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </td>
    </tr>
  )
}

function IdleRow({ ev, idx }: { ev: RealtimeEvent; idx: number }) {
  const router = useRouter()
  return (
    <tr
      className="group border-b border-gray-100 bg-white hover:bg-amber-50/30 transition-colors cursor-pointer"
      onClick={() => router.push(`/dashboard/process-details/${encodeURIComponent(ev.project_id)}`)}
    >
      <td className="pl-5 pr-2 py-3 text-xs font-bold text-gray-300 text-center w-8">
        {String(idx + 1).padStart(2, '0')}
      </td>
      <td className="px-3 py-3 min-w-[160px]">
        <p className="font-mono text-xs font-bold text-gray-800 group-hover:text-amber-700 transition-colors">
          {ev.project_id}
        </p>
        {ev.dwg_name && (
          <p className="text-[11px] text-gray-400 truncate max-w-[220px] mt-0.5">{ev.dwg_name}</p>
        )}
        {ev.level1 && (
          <p className="text-[10px] text-gray-300 mt-0.5">{[ev.level1, ev.level2].filter(Boolean).join(' › ')}</p>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="text-[11px] text-gray-400 truncate block max-w-[200px]">{ev.process || '—'}</span>
      </td>
      <td className="px-3 py-3 w-36 text-xs text-gray-500 whitespace-nowrap">
        {ev.due_date ? new Date(ev.due_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
      </td>
      <td className="px-3 py-3 w-36 text-xs text-gray-500 whitespace-nowrap">
        {ev.received_date ? new Date(ev.received_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
      </td>
      <td className="pr-4 py-3 w-10 text-right">
        <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
      </td>
    </tr>
  )
}

const PROCESS_OPTIONS = ['ทั้งหมด', 'CAM', 'CNC', 'ML', 'LATHE', 'QC', 'SPAR', 'TAP', 'MATERAIL']

export default function RealtimePage() {
  const [data, setData] = useState<RealtimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [filterProcess, setFilterProcess] = useState('ทั้งหมด')
  const [showFilter, setShowFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [idlePage, setIdlePage] = useState(1)
  const [completedPage, setCompletedPage] = useState(1)
  const [tableTab, setTableTab] = useState<'active' | 'idle' | 'completed'>('active')
  const [idleSearch, setIdleSearch] = useState('')
  const [completedSearch, setCompletedSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const PAGE_SIZE = 50

  useEffect(() => { setPage(1) }, [search, filterProcess])
  useEffect(() => { setIdlePage(1) }, [idleSearch])
  useEffect(() => { setCompletedPage(1) }, [completedSearch])

  // single clock for all elapsed timers — ticks every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/realtime', {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('fetch failed')
      const json: RealtimeData = await res.json()
      setData(json)
      setConnected(true)
      setLastUpdated(new Date())
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // socket.io — re-fetch immediately when server emits realtime:update
  useEffect(() => {
    const socket: Socket = socketIO({ path: '/api/socket', transports: ['websocket', 'polling'] })
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('realtime:update', () => fetchData())
    return () => { socket.disconnect() }
  }, [fetchData])

  // fallback poll every 30s in case socket misses something
  useEffect(() => {
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])


  const filtered = (data?.events ?? []).filter((ev) => {
    if (ev.status !== 'running') return false
    const matchSearch =
      !search ||
      ev.project_id.toLowerCase().includes(search.toLowerCase()) ||
      ev.dwg_name.toLowerCase().includes(search.toLowerCase()) ||
      ev.worker_id.toLowerCase().includes(search.toLowerCase()) ||
      ev.process.toLowerCase().includes(search.toLowerCase())
    const matchProcess = filterProcess === 'ทั้งหมด' || ev.process.toUpperCase().includes(filterProcess)
    return matchSearch && matchProcess
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filteredIdle = (data?.events ?? []).filter((ev) => {
    if (ev.status !== 'idle') return false
    if (!idleSearch) return true
    const q = idleSearch.toLowerCase()
    return (
      ev.project_id.toLowerCase().includes(q) ||
      ev.dwg_name.toLowerCase().includes(q) ||
      ev.process.toLowerCase().includes(q)
    )
  })
  const idleTotalPages = Math.max(1, Math.ceil(filteredIdle.length / PAGE_SIZE))
  const paginatedIdle = filteredIdle.slice((idlePage - 1) * PAGE_SIZE, idlePage * PAGE_SIZE)

  const filteredCompleted = (data?.events ?? []).filter((ev) => {
    if (ev.status !== 'completed') return false
    if (!completedSearch) return true
    const q = completedSearch.toLowerCase()
    return (
      ev.project_id.toLowerCase().includes(q) ||
      ev.dwg_name.toLowerCase().includes(q) ||
      ev.worker_id.toLowerCase().includes(q) ||
      ev.process.toLowerCase().includes(q)
    )
  })
  const completedTotalPages = Math.max(1, Math.ceil(filteredCompleted.length / PAGE_SIZE))
  const paginatedCompleted = filteredCompleted.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE)

  return (
    <div className="space-y-5 font-sans">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-900 bg-[url('/bg/bg2.png')] bg-cover bg-center p-6 text-white shadow-sm">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Real-time Monitor
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">ติดตามสถานะการผลิตแบบสด</h1>
            <p className="text-xs text-gray-300">อัปเดตทุก 5 วินาที — แสดงทุกกระบวนการที่กำลังทำงานอยู่</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <p className="text-2xl font-extrabold text-emerald-400">{data?.running ?? 0}</p>
              <p className="text-[10px] text-gray-300 font-medium">กำลังทำงาน</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <p className="text-2xl font-extrabold text-amber-300">{data?.idle ?? 0}</p>
              <p className="text-[10px] text-gray-300 font-medium">รอดำเนินการ</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <p className="text-2xl font-extrabold text-blue-300">{data?.completed ?? 0}</p>
              <p className="text-[10px] text-gray-300 font-medium">เสร็จแล้ว</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <p className="text-2xl font-extrabold text-white">{data?.total ?? 0}</p>
              <p className="text-[10px] text-gray-300 font-medium">รายการทั้งหมด</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Connection + last updated */}
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              <Wifi className="h-3.5 w-3.5" /> เชื่อมต่อแล้ว
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold animate-pulse">
              <WifiOff className="h-3.5 w-3.5" /> ขาดการเชื่อมต่อ
            </span>
          )}
          {lastUpdated && (
            <span className="text-gray-400 hidden sm:inline">
              อัปเดต {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา Job, DWG, พนักงาน, Process..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7B1A1A]/30 focus:border-[#7B1A1A] transition-all"
          />
        </div>

        {/* Process only (status filter removed — tabs handle status) */}

        {/* Process dropdown */}
        <div className="relative shrink-0">
          <button onClick={() => setShowFilter((p) => !p)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-xs font-semibold bg-white text-gray-600 hover:bg-gray-50 transition-all">
            <Filter className="h-3.5 w-3.5" />
            {filterProcess}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
          </button>
          {showFilter && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-1 min-w-[140px]">
              {PROCESS_OPTIONS.map((p) => (
                <button key={p} onClick={() => { setFilterProcess(p); setShowFilter(false) }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all ${filterProcess === p ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          รีเฟรช
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-100 bg-gray-50/60 px-5 gap-0">
          <button
            onClick={() => setTableTab('active')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              tableTab === 'active'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live Monitor
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tableTab === 'active' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {(data?.running ?? 0) + (data?.completed ?? 0)}
            </span>
          </button>
          <button
            onClick={() => setTableTab('idle')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              tableTab === 'idle'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            รอดำเนินการ
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tableTab === 'idle' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {data?.idle ?? 0}
            </span>
          </button>
          <button
            onClick={() => setTableTab('completed')}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              tableTab === 'completed'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            เสร็จแล้ว
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tableTab === 'completed' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {data?.completed ?? 0}
            </span>
          </button>
        </div>

        {/* ── Tab: Live Monitor ── */}
        {tableTab === 'active' && (
          <>
            {/* Summary row */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                กำลังทำงาน {filtered.length} รายการ
              </span>
              <span className="text-xs text-gray-400">รวม {filtered.length} รายการ</span>
            </div>

            {loading ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 border-b border-gray-50 bg-gray-50/40 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Play className="h-10 w-10 text-gray-200" />
                <p className="text-gray-400 text-sm font-medium">ไม่พบข้อมูลที่ตรงกัน</p>
                <button
                  onClick={() => { setSearch(''); setFilterProcess('ทั้งหมด') }}
                  className="text-xs text-[#7B1A1A] hover:underline font-semibold"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="pl-5 pr-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center w-8">#</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">สถานะ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">JOB / DWG</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-36">กระบวนการ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-32">พนักงาน</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">เวลา เริ่ม/จบ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">ใช้เวลา</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-40">ความคืบหน้า</th>
                      <th className="pr-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((ev, i) => (
                      <TableRow
                        key={`${ev.project_id}-${ev.process}-${ev.worker_id}`}
                        ev={ev}
                        idx={(page - 1) * PAGE_SIZE + i}
                        now={now}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                <span className="text-xs text-gray-400">
                  แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ‹ ก่อนหน้า
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let p: number
                    if (totalPages <= 7) p = i + 1
                    else if (page <= 4) p = i + 1
                    else if (page >= totalPages - 3) p = totalPages - 6 + i
                    else p = page - 3 + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${p === page ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: รอดำเนินการ ── */}
        {tableTab === 'idle' && (
          <>
            {/* Search bar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหา Job, DWG, Process..."
                  value={idleSearch}
                  onChange={(e) => setIdleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-300 focus:border-amber-400 transition-all"
                />
              </div>
              <span className="text-xs text-gray-400">{filteredIdle.length} รายการ</span>
            </div>

            {loading ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 border-b border-gray-50 bg-gray-50/40 animate-pulse" />
                ))}
              </div>
            ) : filteredIdle.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Clock className="h-10 w-10 text-gray-200" />
                <p className="text-gray-400 text-sm font-medium">ไม่พบรายการที่รอดำเนินการ</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-amber-50/40">
                      <th className="pl-5 pr-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center w-8">#</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">JOB / DWG</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">กระบวนการ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-36">กำหนดส่ง</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-36">วันที่รับ</th>
                      <th className="pr-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedIdle.map((ev, i) => (
                      <IdleRow
                        key={`idle-${ev.project_id}-${i}`}
                        ev={ev}
                        idx={(idlePage - 1) * PAGE_SIZE + i}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Idle Pagination */}
            {!loading && idleTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                <span className="text-xs text-gray-400">
                  แสดง {(idlePage - 1) * PAGE_SIZE + 1}–{Math.min(idlePage * PAGE_SIZE, filteredIdle.length)} จาก {filteredIdle.length} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setIdlePage((p) => Math.max(1, p - 1))} disabled={idlePage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ‹ ก่อนหน้า
                  </button>
                  {Array.from({ length: Math.min(7, idleTotalPages) }, (_, i) => {
                    let p: number
                    if (idleTotalPages <= 7) p = i + 1
                    else if (idlePage <= 4) p = i + 1
                    else if (idlePage >= idleTotalPages - 3) p = idleTotalPages - 6 + i
                    else p = idlePage - 3 + i
                    return (
                      <button key={p} onClick={() => setIdlePage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${p === idlePage ? 'bg-amber-500 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setIdlePage((p) => Math.min(idleTotalPages, p + 1))} disabled={idlePage === idleTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: เสร็จแล้ว ── */}
        {tableTab === 'completed' && (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหา Job, DWG, พนักงาน, Process..."
                  value={completedSearch}
                  onChange={(e) => setCompletedSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 transition-all"
                />
              </div>
              <span className="text-xs text-gray-400">{filteredCompleted.length} รายการ</span>
            </div>

            {loading ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 border-b border-gray-50 bg-gray-50/40 animate-pulse" />
                ))}
              </div>
            ) : filteredCompleted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 className="h-10 w-10 text-gray-200" />
                <p className="text-gray-400 text-sm font-medium">ยังไม่มีงานที่เสร็จแล้ว</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-blue-50/30">
                      <th className="pl-5 pr-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center w-8">#</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">JOB / DWG</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-36">กระบวนการ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">พนักงาน</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">เริ่ม / จบ</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left w-28">ใช้เวลา</th>
                      <th className="pr-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCompleted.map((ev, i) => (
                      <CompletedRow
                        key={`done-${ev.project_id}-${ev.process}-${ev.worker_id}-${i}`}
                        ev={ev}
                        idx={(completedPage - 1) * PAGE_SIZE + i}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && completedTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                <span className="text-xs text-gray-400">
                  แสดง {(completedPage - 1) * PAGE_SIZE + 1}–{Math.min(completedPage * PAGE_SIZE, filteredCompleted.length)} จาก {filteredCompleted.length} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCompletedPage((p) => Math.max(1, p - 1))} disabled={completedPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ‹ ก่อนหน้า
                  </button>
                  {Array.from({ length: Math.min(7, completedTotalPages) }, (_, i) => {
                    let p: number
                    if (completedTotalPages <= 7) p = i + 1
                    else if (completedPage <= 4) p = i + 1
                    else if (completedPage >= completedTotalPages - 3) p = completedTotalPages - 6 + i
                    else p = completedPage - 3 + i
                    return (
                      <button key={p} onClick={() => setCompletedPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${p === completedPage ? 'bg-blue-500 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setCompletedPage((p) => Math.min(completedTotalPages, p + 1))} disabled={completedPage === completedTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Empty global */}
      {!loading && data && data.total === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
          <Activity className="h-8 w-8 opacity-30" />
          <p className="text-sm">ยังไม่มีกระบวนการที่บันทึกเวลาไว้</p>
          <p className="text-xs">เริ่มต้น scan บาร์โค้ดที่หน้า process-details เพื่อให้ข้อมูลปรากฏที่นี่</p>
        </div>
      )}
    </div>
  )
}
