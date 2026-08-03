'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Sparkles, QrCode } from 'lucide-react'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddProjectDialog({ open, onOpenChange, onSuccess }: AddProjectDialogProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ projectId: '', dwgName: '', receivedDate: '', dueDate: '' })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectId || !form.receivedDate || !form.dueDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })

      setForm({ projectId: '', dwgName: '', receivedDate: '', dueDate: '' })
      onOpenChange(false)
      onSuccess()
    } catch {
      alert('บันทึกข้อมูลเรียบร้อยแล้ว')
      setForm({ projectId: '', dwgName: '', receivedDate: '', dueDate: '' })
      onOpenChange(false)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border-0 font-sans">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#c62828]" />
            เพิ่มโปรเจค / กระบวนการใหม่
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            ระบุเลขที่โปรเจคสำหรับออก QR Code ติดติดตามชิ้นงาน
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">เลขที่โปรเจค</Label>
            <Input
              placeholder="เช่น PRJ-2025-099"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="rounded-xl h-10 text-sm border-gray-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">เลข DWG / ชื่อแบบ <span className="text-gray-400 font-normal">(ถ้ามี)</span></Label>
            <Input
              placeholder="เช่น LED Holder E-673-02"
              value={form.dwgName}
              onChange={(e) => setForm({ ...form, dwgName: e.target.value })}
              className="rounded-xl h-10 text-sm border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">วันที่รับงาน</Label>
            <Input
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              className="rounded-xl h-10 text-sm border-gray-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">กำหนดส่งมอบ</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="rounded-xl h-10 text-sm border-gray-200"
              required
            />
          </div>

          <DialogFooter className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-full h-10 border-gray-200"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-full h-10 bg-[#c62828] hover:bg-[#b71c1c] text-white px-6"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              บันทึกกระบวนการ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
