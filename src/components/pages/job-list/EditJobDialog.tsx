'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Trash2 } from 'lucide-react'

interface Attachment {
  file_url: string
  file_name: string
}

interface EditableJob {
  job_code: string
  job_note?: string
  sender?: string
  drawing_name: string
  quantity: number
  received_date?: string | Date | null
  due_date?: string | Date | null
  file_url?: string
  file_name?: string
  attachments?: Attachment[]
}

const allowedExtensions = new Set(['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf'])

function toDateInputValue(val?: string | Date | null): string {
  if (!val) return ''
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return ''
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    if (trimmed.includes('T')) {
      const datePart = trimmed.split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  return ''
}

export function EditJobDialog({ job, onClose, onSuccess }: {
  job: EditableJob
  onClose: () => void
  onSuccess: () => Promise<void>
}) {
  const [code, setCode] = useState(job.job_code)
  const [name, setName] = useState(job.drawing_name)
  const [note, setNote] = useState(job.job_note ?? '')
  const [sender, setSender] = useState(job.sender ?? '')
  const [quantity, setQuantity] = useState(String(job.quantity))
  const [receivedDate, setReceivedDate] = useState(() => toDateInputValue(job.received_date))
  const [dueDate, setDueDate] = useState(() => toDateInputValue(job.due_date))
  const [existing, setExisting] = useState<Attachment[]>(
    job.attachments?.length ? job.attachments : job.file_url && job.file_name
      ? [{ file_url: job.file_url, file_name: job.file_name }] : [],
  )
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!code.trim()) { setError('กรุณากรอกเลข Job'); return }
    if (!name.trim()) { setError('กรุณากรอกชื่อแบบ'); return }
    const parsedQuantity = Number(quantity)
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      setError('จำนวนชิ้นงานต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป')
      return
    }
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const uploaded: Attachment[] = []
      for (const file of newFiles) {
        const data = new FormData()
        data.append('file', file)
        data.append('projectId', job.job_code)
        const response = await fetch('/api/upload', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || `อัปโหลด ${file.name} ไม่สำเร็จ`)
        uploaded.push({ file_url: result.publicUrl, file_name: file.name })
      }
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.job_code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          job_code: code.trim().toUpperCase(),
          drawing_name: name.trim(),
          job_note: note.trim(),
          sender: sender.trim(),
          quantity: parsedQuantity,
          received_date: receivedDate.trim(),
          due_date: dueDate.trim(),
          attachments: [...existing, ...uploaded],
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'บันทึกไม่สำเร็จ')
      await onSuccess()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไข Job {job.job_code}</DialogTitle>
          <DialogDescription>แก้ไขเลข Job ชื่อแบบ หมายเหตุ จำนวนชิ้นงาน วันรับงาน วันกำหนดส่งมอบ และไฟล์ของ Job นี้</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-code">เลข Job</Label>
            <Input id="edit-job-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={saving} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-name">ชื่อแบบ</Label>
            <Input id="edit-job-name" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-note">หมายเหตุ</Label>
            <Input id="edit-job-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} placeholder="เช่น ตัดแมท" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-quantity">จำนวนชิ้นงาน</Label>
            <Input id="edit-job-quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-sender">ผู้สั่งงาน</Label>
            <Input id="edit-job-sender" value={sender} onChange={(event) => setSender(event.target.value)} disabled={saving} placeholder="ชื่อผู้สั่งงาน" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-job-received-date">วันรับงาน</Label>
              <Input id="edit-job-received-date" type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-job-due-date">วันกำหนดส่งมอบ</Label>
              <Input id="edit-job-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ไฟล์ปัจจุบัน</Label>
            {existing.length === 0 && <p className="text-sm text-gray-400">ไม่มีไฟล์</p>}
            {existing.map((file, index) => (
              <div key={`${file.file_url}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{file.file_name}</span>
                <Button type="button" size="sm" variant="ghost" disabled={saving}
                  onClick={() => setExisting((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`นำ ${file.file_name} ออก`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-job-files">เพิ่มไฟล์</Label>
            <Input id="edit-job-files" type="file" multiple accept=".pdf,.stl,.step,.stp,.obj,.3mf,.glb,.gltf"
              disabled={saving} onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.some((file) => !allowedExtensions.has(file.name.split('.').pop()?.toLowerCase() ?? ''))) {
                  setError('รองรับเฉพาะ PDF และไฟล์ 3D ที่กำหนด')
                  return
                }
                setError('')
                setNewFiles((prev) => [...prev, ...files])
                event.target.value = ''
              }} />
            {newFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{file.name}</span>
                <Button type="button" size="sm" variant="ghost" disabled={saving}
                  onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`นำ ${file.name} ออก`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button type="button" onClick={save} disabled={saving || !code.trim() || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
