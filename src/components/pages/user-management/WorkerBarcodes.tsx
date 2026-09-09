'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import { Printer, ShieldOff, ShieldCheck, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useWorkersList } from '@/lib/useWorkersList'
import type { WorkerData } from '@/lib/workers'

const Barcoder = dynamic(() => import('react-barcode'), { ssr: false })

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

interface WorkerRow extends WorkerData {
  id: string
}

const emptyForm = { code: '', name: '', machines: '', username: '' }

export function WorkerBarcodes() {
  const { workers, loading, refresh } = useWorkersList()
  const [blockedCodes, setBlockedCodes] = useState<Set<number>>(new Set())
  const [toggling, setToggling] = useState<number | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<WorkerRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deletingWorker, setDeletingWorker] = useState<WorkerRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await fetch('/api/workers/block', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) return
      const codes: number[] = await res.json()
      setBlockedCodes(new Set(codes))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchBlocked() }, [fetchBlocked])

  async function toggleBlock(code: number, name: string, currentlyBlocked: boolean) {
    setToggling(code)
    try {
      await fetch('/api/workers/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ code, name, block: !currentlyBlocked }),
      })
      setBlockedCodes((prev) => {
        const next = new Set(prev)
        if (currentlyBlocked) next.delete(code)
        else next.add(code)
        return next
      })
    } catch { /* ignore */ }
    finally { setToggling(null) }
  }

  function openAddForm() {
    setEditingWorker(null)
    setForm(emptyForm)
    setFormError('')
    setIsFormOpen(true)
  }

  function openEditForm(w: WorkerRow) {
    setEditingWorker(w)
    setForm({
      code: String(w.code),
      name: w.name,
      machines: w.machines.join(', '),
      username: w.username ?? '',
    })
    setFormError('')
    setIsFormOpen(true)
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('กรุณากรอกรหัสและชื่อพนักงาน')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        code: Number(form.code),
        name: form.name.trim(),
        machines: form.machines.split(',').map((m) => m.trim()).filter(Boolean),
        username: form.username.trim() || undefined,
      }
      const res = await fetch('/api/workers', {
        method: editingWorker ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(editingWorker ? { id: editingWorker.id, ...payload } : payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'เกิดข้อผิดพลาด')
        return
      }
      setIsFormOpen(false)
      refresh()
    } catch {
      setFormError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingWorker) return
    setDeleting(true)
    try {
      await fetch(`/api/workers?id=${deletingWorker.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setDeletingWorker(null)
      refresh()
    } finally {
      setDeleting(false)
    }
  }

  const list = (workers as WorkerRow[]).filter((w) => w.code !== 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-800">บาร์โค้ดพนักงาน</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            สแกนเพื่อระบุตัวพนักงาน — กดบล็อกเพื่อระงับสิทธิ์สแกนชั่วคราว
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            onClick={openAddForm}
            size="sm"
            className="gap-1.5 rounded-full h-8 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-3.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มพนักงาน
          </Button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            ปริ้นทั้งหมด
          </button>
        </div>
      </div>

      {/* Stats row */}
      {blockedCodes.size > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100 print:hidden">
          <ShieldOff className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs font-semibold text-red-700">
            บล็อกอยู่ {blockedCodes.size} คน — ไม่สามารถสแกนงานได้จนกว่าจะยกเลิกบล็อก
          </span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">ยังไม่มีพนักงาน — กด &ldquo;เพิ่มพนักงาน&rdquo; เพื่อเริ่มต้น</div>
      ) : (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 print:grid-cols-4 print:gap-2 print:p-2">
          {list.map((worker) => {
            const isBlocked = blockedCodes.has(worker.code)
            const isToggling = toggling === worker.code
            return (
              <div
                key={worker.id}
                className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 pt-3 pb-2 transition-colors print:border print:border-gray-300 print:rounded-lg ${
                  isBlocked
                    ? 'border-red-200 bg-red-50/60'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                {/* Blocked overlay text */}
                {isBlocked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-red-100/40 print:hidden">
                    <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200 tracking-widest">
                      BLOCKED
                    </span>
                  </div>
                )}

                {/* Edit / Delete */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-10 print:hidden">
                  <button
                    onClick={() => openEditForm(worker)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                    title="แก้ไข"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeletingWorker(worker)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-white transition-colors"
                    title="ลบ"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className={isBlocked ? 'opacity-30 pointer-events-none select-none' : ''}>
                  <Barcoder
                    value={String(worker.code)}
                    format="CODE128"
                    width={1.8}
                    height={56}
                    fontSize={11}
                    margin={2}
                    background={isBlocked ? '#fef2f2' : '#f9fafb'}
                    lineColor="#111827"
                    displayValue={false}
                  />
                  <p className="text-[13px] font-bold text-gray-800 tabular-nums text-center">{worker.code}</p>
                  <p className="text-[10px] text-gray-500 text-center leading-tight line-clamp-2">{worker.name}</p>
                  <p className="text-[9px] text-gray-400 text-center leading-tight">{worker.machines.join(', ')}</p>
                </div>

                {/* Block/Unblock button */}
                <button
                  onClick={() => toggleBlock(worker.code, worker.name, isBlocked)}
                  disabled={isToggling}
                  className={`mt-1 relative z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all print:hidden ${
                    isBlocked
                      ? 'bg-white border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {isToggling ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isBlocked ? (
                    <><ShieldCheck className="h-3 w-3" /> ยกเลิกบล็อก</>
                  ) : (
                    <><ShieldOff className="h-3 w-3" /> บล็อก</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingWorker ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</DialogTitle>
            <DialogDescription>
              รหัสพนักงานใช้สำหรับสแกนบาร์โค้ด และเครื่องจักรกำหนดสิทธิ์ว่าสแกนกระบวนการใดได้บ้าง
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="w-code" className="text-xs font-semibold text-gray-700">รหัสพนักงาน</Label>
              <Input
                id="w-code"
                type="number"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="rounded-xl h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-name" className="text-xs font-semibold text-gray-700">ชื่อ-นามสกุล</Label>
              <Input
                id="w-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-machines" className="text-xs font-semibold text-gray-700">เครื่องจักร / สิทธิ์ (คั่นด้วยจุลภาค)</Label>
              <Input
                id="w-machines"
                value={form.machines}
                onChange={(e) => setForm((f) => ({ ...f, machines: e.target.value }))}
                placeholder="เช่น CNC 1, CNC 2, LATHE 1"
                className="rounded-xl h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-username" className="text-xs font-semibold text-gray-700">Username สำหรับเข้าระบบ (ถ้ามี)</Label>
              <Input
                id="w-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="เว้นว่างได้ถ้าไม่มีบัญชีเข้าระบบ"
                className="rounded-xl h-10 text-sm"
              />
            </div>
            {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-[#7B1A1A] hover:bg-[#5C1212] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingWorker ? 'บันทึก' : 'เพิ่มพนักงาน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm Dialog */}
      <Dialog open={!!deletingWorker} onOpenChange={(o) => { if (!o) setDeletingWorker(null) }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบพนักงาน</DialogTitle>
            <DialogDescription>
              ต้องการลบ <span className="font-semibold text-gray-700">{deletingWorker?.name}</span> ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingWorker(null)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
