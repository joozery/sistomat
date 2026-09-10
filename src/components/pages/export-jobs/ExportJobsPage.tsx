'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProcessOptions } from '@/lib/useProcessOptions'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useWorkersList } from '@/lib/useWorkersList'

const STATUS_OPTIONS = ['กำลังดำเนินการ', 'รับงาน', 'จบงาน', 'ไม่รับงาน', 'ยกเลิก']

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

interface ExportRow {
  job_code: string
  dwg_name: string
  received_date: string | null
  due_date: string | null
  status: string
  index: number
  process: string
  target_time: string
  skill: string
  elapsed_time: string
  workers: string
}

export function ExportJobsPage() {
  const { role } = useCurrentUser()
  const canSeeSkill = role !== 'User'
  const { options: processOptions } = useProcessOptions()
  const { workers } = useWorkersList()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('all')
  const [process, setProcess] = useState('all')
  const [worker, setWorker] = useState('all')

  const [rows, setRows] = useState<ExportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (status !== 'all') params.set('status', status)
      if (process !== 'all') params.set('process', process)
      if (worker !== 'all') params.set('worker', worker)

      const res = await fetch(`/api/jobs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('load failed')
      const data: ExportRow[] = await res.json()
      setRows(data)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }, [from, to, status, process, worker])

  const clearFilters = () => {
    setFrom('')
    setTo('')
    setStatus('all')
    setProcess('all')
    setWorker('all')
  }

  const elapsedToSeconds = (elapsed: string) => {
    const [h, m, s] = elapsed.split(':').map((v) => parseInt(v, 10) || 0)
    return h * 3600 + m * 60 + s
  }

  const totalMinutes = useMemo(
    () => Math.round(rows.reduce((sum, r) => sum + elapsedToSeconds(r.elapsed_time), 0) / 60),
    [rows],
  )

  const processSummary = useMemo(() => {
    const seconds = new Map<string, number>()
    for (const r of rows) {
      const key = r.process || '(ไม่ระบุ)'
      seconds.set(key, (seconds.get(key) ?? 0) + elapsedToSeconds(r.elapsed_time))
    }
    return Array.from(seconds.entries())
      .map(([processName, secs]) => ({ process: processName, minutes: Math.round(secs / 60) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [rows])

  const handleExportExcel = async () => {
    if (rows.length === 0) return
    const XLSX = await import('xlsx')
    const data = rows.map((r) => {
      const base: Record<string, string | number> = {
        'Job': r.job_code,
        'DWG': r.dwg_name,
        'ลำดับ': r.index,
        'กระบวนการ': r.process,
        'เป้าหมาย (นาที)': r.target_time,
      }
      if (canSeeSkill) base['SKILL'] = r.skill
      base['รวมเวลา'] = r.elapsed_time
      base['พนักงาน'] = r.workers
      base['สถานะ'] = r.status
      return base
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ตารางงาน')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `ตารางงาน-${stamp}.xlsx`)
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Export ตารางงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">เลือกตัวกรองแล้วดูตาราง หรือส่งออกเป็น Excel</p>
        </div>
        <Button
          onClick={handleExportExcel}
          disabled={rows.length === 0}
          className="gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 px-4"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">วันที่รับงาน (จาก)</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">ถึง</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">สถานะ</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">กระบวนการ</label>
            <Select value={process} onValueChange={setProcess}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกกระบวนการ</SelectItem>
                {processOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">พนักงาน</label>
            <Select value={worker} onValueChange={setWorker}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกคน</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.code} value={String(w.code)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={fetchRows}
              disabled={loading}
              className="gap-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold h-9 px-4 flex-1"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              ค้นหา
            </Button>
            <Button
              onClick={clearFilters}
              variant="outline"
              className="gap-1.5 rounded-full border-gray-200 text-gray-600 text-xs font-semibold h-9 px-3"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-[#fde047]">
          <h2 className="text-base font-bold text-gray-900 tracking-wide">ตารางงาน</h2>
          {searched && (
            <span className="text-xs font-semibold text-gray-700">
              {rows.length} แถว {rows.length > 0 && `· รวมเวลาทั้งหมด ${totalMinutes.toLocaleString()} นาที`}
            </span>
          )}
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && rows.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            {processSummary.map((s) => (
              <span
                key={s.process}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs"
              >
                <span className="font-semibold text-gray-700">{s.process}</span>
                <span className="text-gray-500">{s.minutes.toLocaleString()} นาที</span>
              </span>
            ))}
          </div>
        )}

        {!error && !searched && (
          <p className="px-5 py-8 text-center text-sm text-gray-400">เลือกตัวกรองแล้วกด &quot;ค้นหา&quot; เพื่อแสดงตาราง</p>
        )}

        {!error && searched && rows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-gray-400">ไม่พบข้อมูลตามตัวกรองที่เลือก</p>
        )}

        {!error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#a5f3fc' }}>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-30">Job</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-35">DWG</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-10">ลำดับ</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-25">กระบวนการ</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-16 leading-snug">
                    เป้าหมาย<br /><span className="font-normal text-[10px]">(นาที)</span>
                  </th>
                  {canSeeSkill && (
                    <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-12">SKILL</th>
                  )}
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-20">รวมเวลา</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-40">พนักงาน</th>
                  <th className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-24">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.job_code}-${r.index}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700">{r.job_code}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{r.dwg_name || '—'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{r.index}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{r.process || '—'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{r.target_time || '—'}</td>
                    {canSeeSkill && (
                      <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{r.skill || '—'}</td>
                    )}
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{r.elapsed_time || '00:00:00'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{r.workers || '—'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{r.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
