'use client'

import { useEffect, useState } from 'react'
import { Cpu, ClipboardCheck, CheckCircle2, Clock, Loader2 } from 'lucide-react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

interface Stats {
  running: number
  idle: number
  totalProcesses: number
  completedProcesses: number
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = getToken()
      const h = { Authorization: `Bearer ${token}` }
      try {
        const [rtRes, sumRes] = await Promise.all([
          fetch('/api/realtime', { headers: h }),
          fetch('/api/jobs/process-summary', { headers: h }),
        ])
        const rt = rtRes.ok ? await rtRes.json() : null
        const sum = sumRes.ok ? await sumRes.json() : []

        const totalProcesses = Array.isArray(sum)
          ? sum.reduce((a: number, b: { job_count: number }) => a + b.job_count, 0)
          : 0
        const completedProcesses = Array.isArray(sum)
          ? sum.reduce((a: number, b: { completed_count: number }) => a + b.completed_count, 0)
          : 0

        setStats({
          running: rt?.running ?? 0,
          idle: rt?.idle ?? 0,
          totalProcesses,
          completedProcesses,
        })
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const completionPct = stats && stats.totalProcesses > 0
    ? Math.round((stats.completedProcesses / stats.totalProcesses) * 100)
    : 0

  const cards = [
    {
      title: 'Worker กำลังทำงานอยู่',
      value: loading ? '—' : String(stats?.running ?? 0),
      unit: 'session',
      subtext: `รอดำเนินการ ${stats?.idle ?? '—'} งาน`,
      icon: Cpu,
      color: 'text-[#7B1A1A] bg-red-50 border-red-100',
    },
    {
      title: 'กระบวนการทั้งหมดในระบบ',
      value: loading ? '—' : String(stats?.totalProcesses ?? 0),
      unit: 'ขั้นตอน',
      subtext: 'จากทุก project ในระบบ',
      icon: ClipboardCheck,
      color: 'text-purple-700 bg-purple-50 border-purple-100',
    },
    {
      title: 'กระบวนการเสร็จสมบูรณ์',
      value: loading ? '—' : String(stats?.completedProcesses ?? 0),
      unit: 'ขั้นตอน',
      subtext: 'ยืนยันแล้วด้วย CMD_NEXT',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'อัตราการเสร็จรวม',
      value: loading ? '—' : `${completionPct}%`,
      unit: '',
      subtext: `${stats?.completedProcesses ?? 0} / ${stats?.totalProcesses ?? 0} ขั้นตอน`,
      icon: Clock,
      color: 'text-blue-700 bg-blue-50 border-blue-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {cards.map((card) => (
        <div
          key={card.title}
          className="relative overflow-hidden rounded-xl bg-white p-5 border border-gray-100/90 shadow-sm/50 transition-all hover:border-gray-200"
        >
          <div className="flex items-start justify-between">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-300 mt-1" />}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400">{card.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl lg:text-3xl font-extrabold text-gray-800 tracking-tight">
                {card.value}
              </span>
              {card.unit && <span className="text-xs font-bold text-gray-500">{card.unit}</span>}
            </div>
            <p className="text-[11px] font-medium text-gray-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {card.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
