'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cpu, ArrowUpRight, QrCode, Loader2, Play, Clock } from 'lucide-react'
import Link from 'next/link'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

interface RealtimeEvent {
  project_id: string
  dwg_name: string
  process: string
  worker_id: string
  start_time: string
  stop_time: string | null
  status: 'running' | 'idle' | 'completed'
}

function elapsed(startTime: string): string {
  if (!startTime) return '—'
  try {
    const now = Date.now()
    const todayStr = new Date(now).toISOString().split('T')[0]
    const parts = startTime.split(':')
    const normalized = parts.length === 2 ? `${startTime}:00` : startTime
    let ms = new Date(`${todayStr}T${normalized}`).getTime()
    if (ms > now + 60000) ms = new Date(`${new Date(now - 86400000).toISOString().split('T')[0]}T${normalized}`).getTime()
    const secs = Math.max(0, Math.floor((now - ms) / 1000))
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  } catch { return '—' }
}

export function JobApplicationSection() {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    async function load() {
      const token = getToken()
      try {
        const res = await fetch('/api/realtime', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          // show running first, then idle — max 8 cards
          const running: RealtimeEvent[] = (data.events ?? []).filter((e: RealtimeEvent) => e.status === 'running')
          const idle: RealtimeEvent[] = (data.events ?? []).filter((e: RealtimeEvent) => e.status === 'idle')
          setEvents([...running, ...idle].slice(0, 8))
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    const fetchInterval = setInterval(load, 30000)
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => { clearInterval(fetchInterval); clearInterval(tickInterval) }
  }, [])

  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#7B1A1A]" />
            สถานะกระบวนการที่กำลังดำเนินอยู่
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">อัปเดตทุก 30 วินาที</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <Link
            href="/dashboard/process-qrcode"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#7B1A1A] bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            สแกน QR Code
          </Link>
          <Link
            href="/dashboard/realtime"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ดูทั้งหมด
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {!loading && events.length === 0 ? (
          <div className="flex items-center justify-center h-28 text-sm text-gray-400">
            ไม่มีกระบวนการที่กำลังดำเนินการอยู่
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {events.map((ev, i) => {
              const isRunning = ev.status === 'running'
              return (
                <Link
                  key={`${ev.project_id}-${ev.worker_id}-${i}`}
                  href={`/dashboard/process-details/${ev.project_id}`}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:bg-white hover:border-gray-200 hover:shadow-sm block"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-[#7B1A1A] truncate max-w-[100px]">
                      {ev.project_id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      isRunning
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {isRunning ? <Play className="h-2.5 w-2.5 fill-current" /> : <Clock className="h-2.5 w-2.5" />}
                      {isRunning ? 'กำลังทำงาน' : 'รอดำเนินการ'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-gray-800 truncate">{ev.process || '—'}</h4>
                  <p className="text-[11px] text-gray-400 mb-3 truncate">{ev.dwg_name || '—'}</p>

                  <div className="space-y-1.5 pt-2 border-t border-gray-100 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Worker:</span>
                      <span className="font-semibold text-gray-700 truncate max-w-[100px]">
                        {ev.worker_id || '—'}
                      </span>
                    </div>
                    {isRunning && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">เวลาที่ใช้:</span>
                        <span className="font-mono font-bold text-[#7B1A1A]" suppressHydrationWarning>
                          {elapsed(ev.start_time)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
