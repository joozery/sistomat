'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/lib/useCurrentUser'

type TrashItem = { _id: string; project_id: string; deleted_at: string; purge_at: string; project_count: number; job_count: number; files: { file_name: string }[] }
const formatDate = (value: string) => new Date(value).toLocaleString('th-TH')

export default function TrashPage() {
  const { role } = useCurrentUser()
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const isSuperadmin = role?.trim().toLowerCase() === 'superadmin'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/trash', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'โหลดข้อมูลไม่สำเร็จ')
      setItems(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (isSuperadmin) void load() }, [isSuperadmin, load])

  async function action(id: string, method: 'POST' | 'DELETE') {
    if (!window.confirm(method === 'POST' ? 'ยืนยันกู้คืนรายการนี้?' : 'ยืนยันลบรายการนี้ถาวร? ไม่สามารถกู้คืนได้')) return
    setBusy(id); setError('')
    try {
      const res = await fetch('/api/trash', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'ดำเนินการไม่สำเร็จ')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ') }
    finally { setBusy('') }
  }

  if (!isSuperadmin) return <div className="rounded-xl bg-white p-8 text-center text-sm text-red-600">ไม่มีสิทธิ์เข้าหน้านี้</div>

  return <div className="space-y-5 font-sans">
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><div><h1 className="flex items-center gap-2 text-xl font-bold text-gray-800"><Trash2 className="h-5 w-5 text-[#7B1A1A]" />Trash / Restore</h1><p className="mt-1 text-xs text-gray-500">เก็บข้อมูลและไฟล์แนบไว้ 7 วันก่อนลบถาวร</p></div><Button variant="outline" onClick={() => void load()} disabled={loading} className="rounded-full gap-2"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />รีเฟรช</Button></div>
    {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="rounded-xl bg-white p-12 text-center text-sm text-gray-400">กำลังโหลด...</div> : items.length === 0 ? <div className="rounded-xl bg-white p-12 text-center text-sm text-gray-400">ไม่มีรายการในถังขยะ</div> : <div className="space-y-3">{items.map((item) => <div key={item._id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"><div><p className="font-mono font-bold text-gray-800">{item.project_id}</p><p className="text-xs text-gray-500">ลบเมื่อ {formatDate(item.deleted_at)} · หมดอายุ {formatDate(item.purge_at)}</p><p className="mt-1 text-xs text-gray-500">ข้อมูล {item.project_count + item.job_count} รายการ · ไฟล์แนบ {item.files.length} ไฟล์</p>{item.files.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><FileText className="h-3 w-3" />{item.files.map((file) => file.file_name).join(', ')}</p>}</div><div className="flex gap-2"><Button onClick={() => void action(item._id, 'POST')} disabled={busy === item._id} className="rounded-full gap-2 bg-emerald-600 hover:bg-emerald-700"><RotateCcw className="h-4 w-4" />กู้คืน</Button><Button onClick={() => void action(item._id, 'DELETE')} disabled={busy === item._id} variant="outline" className="rounded-full gap-2 border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />ลบถาวร</Button></div></div>)}</div>}
  </div>
}
