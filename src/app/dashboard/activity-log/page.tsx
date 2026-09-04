'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  LogIn,
  Box,
  FileText,
  Layers,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ActivityLog {
  _id: string
  username: string
  role: string
  action: string
  target: string
  detail: string
  created_at: string
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  login:       { label: 'เข้าสู่ระบบ',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100',   icon: <LogIn className="h-3 w-3" /> },
  view_3d:     { label: 'ดู 3D',           color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100', icon: <Box className="h-3 w-3" /> },
  view_pdf:    { label: 'ดู PDF',          color: 'text-red-700',    bg: 'bg-red-50 border-red-100',      icon: <FileText className="h-3 w-3" /> },
  view_split:  { label: 'ดู PDF+3D',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100', icon: <Layers className="h-3 w-3" /> },
  create_job:  { label: 'สร้าง Job',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: <Plus className="h-3 w-3" /> },
  download_file: { label: 'ดาวน์โหลด',    color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',    icon: <Download className="h-3 w-3" /> },
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: <Activity className="h-3 w-3" /> }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  )
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 50

  const [filterUser, setFilterUser]   = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token') ?? ''
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (filterUser)   params.set('username', filterUser)
      if (filterAction) params.set('action', filterAction)
      if (filterFrom)   params.set('dateFrom', filterFrom)
      if (filterTo)     params.set('dateTo', filterTo)

      const res = await fetch(`/api/activity?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      setLogs(Array.isArray(json.logs) ? json.logs : [])
      setTotal(json.total ?? 0)
      setPage(p)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filterUser, filterAction, filterFrom, filterTo])

  useEffect(() => { loadLogs(1) }, [loadLogs])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <Activity className="h-3 w-3" /> ACTIVITY LOG
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">ประวัติกิจกรรม</h1>
          <p className="text-xs text-gray-400 mt-0.5">ติดตามการใช้งานระบบของผู้ใช้ทุกคน</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadLogs(page)}
          className="gap-1.5 rounded-full text-xs h-8 border-gray-200"
        >
          <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">ผู้ใช้</label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="ค้นหาชื่อผู้ใช้..."
                className="pl-8 h-8 text-xs rounded-lg border-gray-200"
              />
            </div>
          </div>

          <div className="min-w-[140px]">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">ประเภท</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full h-8 text-xs rounded-lg border border-gray-200 bg-white px-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#7B1A1A]/30"
            >
              <option value="">ทั้งหมด</option>
              {Object.entries(ACTION_META).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[130px]">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">จากวันที่</label>
            <Input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="h-8 text-xs rounded-lg border-gray-200"
            />
          </div>

          <div className="min-w-[130px]">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">ถึงวันที่</label>
            <Input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="h-8 text-xs rounded-lg border-gray-200"
            />
          </div>

          <Button
            onClick={() => loadLogs(1)}
            className="h-8 gap-1.5 rounded-full text-xs bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-4 shadow-sm"
          >
            <Filter className="h-3.5 w-3.5" /> กรอง
          </Button>
          <Button
            variant="outline"
            onClick={() => { setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo('') }}
            className="h-8 gap-1.5 rounded-full text-xs border-gray-200 text-gray-500"
          >
            ล้าง
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ACTION_META).slice(0, 4).map(([key, meta]) => {
          const count = logs.filter((l) => l.action === key).length
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm/50 px-4 py-3 flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${meta.bg} ${meta.color}`}>
                {meta.icon}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium">{meta.label}</p>
                <p className="text-sm font-bold text-gray-800">{count} ครั้ง</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">
              ผลลัพธ์ {total.toLocaleString()} รายการ
            </span>
          </div>
          <span className="text-xs text-gray-400">หน้า {page}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Activity className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">ไม่มีกิจกรรม</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-36">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> เวลา</div>
                  </th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-32">
                    <div className="flex items-center gap-1"><User className="h-3 w-3" /> ผู้ใช้</div>
                  </th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">การกระทำ</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">เป้าหมาย</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#7B1A1A] to-[#9B3333] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                          {log.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{log.username}</p>
                          <p className="text-[10px] text-gray-400">{log.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700 max-w-[200px] truncate">
                      {log.target || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[250px] truncate">
                      {log.detail || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadLogs(page - 1)}
              className="gap-1 rounded-full h-7 text-xs border-gray-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> ก่อนหน้า
            </Button>
            <span className="text-xs text-gray-500">หน้า {page} จาก {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => loadLogs(page + 1)}
              className="gap-1 rounded-full h-7 text-xs border-gray-200"
            >
              ถัดไป <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
