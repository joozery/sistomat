'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Layers, Upload, FileText, Box, X, CheckCircle2 } from 'lucide-react'

interface ProcessRow {
  process: string
  person: string
  target_time: string
}

interface AddJobDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  parentId: string
  onSuccess: () => void
}

const ALLOWED_EXT = ['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf']

function suggestCode(parentId: string, existingCodes: string[]): string {
  const nums = existingCodes
    .map((c) => c.match(/^J[A-Z]-\d{3,4}-(\d{3})$/)?.[1])
    .filter(Boolean).map(Number)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${parentId}-${String(next).padStart(3, '0')}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'pdf'
    ? <FileText className="h-4 w-4 text-red-500 shrink-0" />
    : <Box className="h-4 w-4 text-blue-500 shrink-0" />
}

export function AddJobDialog({ open, onOpenChange, parentId, onSuccess }: AddJobDialogProps) {
  const [saving, setSaving] = useState(false)
  const [jobCode, setJobCode] = useState('')
  const [drawingName, setDrawingName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [dueDate, setDueDate] = useState('')
  const [processes, setProcesses] = useState<ProcessRow[]>([{ process: '', person: '', target_time: '' }])
  const [error, setError] = useState('')

  // File upload state
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('token')
    fetch(`/api/jobs?level1=${encodeURIComponent(parentId)}&limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const jobs = Array.isArray(data) ? data : (data.jobs ?? [])
        setJobCode(suggestCode(parentId, jobs.map((j: { job_code: string }) => j.job_code)))
      })
      .catch(() => setJobCode(`${parentId}-001`))
  }, [open, parentId])

  function reset() {
    setJobCode(''); setDrawingName(''); setQuantity('1'); setDueDate('')
    setProcesses([{ process: '', person: '', target_time: '' }])
    setError(''); setFile(null); setFileError('')
    setUploading(false); setUploadProgress(0); setUploadedUrl(null)
  }

  function handleClose(v: boolean) { if (!v) reset(); onOpenChange(v) }

  function pickFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) {
      setFileError('รองรับเฉพาะ PDF, STL, STEP, OBJ, 3MF, GLB')
      return
    }
    setFileError(''); setFile(f); setUploadedUrl(null); setUploadProgress(0)
  }

  async function uploadFile(codeForPath: string): Promise<string | null> {
    if (!file) return null
    setUploading(true); setUploadProgress(0)
    try {
      const token = localStorage.getItem('token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', codeForPath)

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText).publicUrl)
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).message)) }
            catch { reject(new Error('อัปโหลดไม่สำเร็จ')) }
          }
        }
        xhr.onerror = () => reject(new Error('เชื่อมต่อไม่ได้'))
        xhr.open('POST', '/api/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(fd)
      })

      setUploadedUrl(url)
      return url
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!jobCode.trim()) { setError('กรุณากรอก Job Code'); return }
    setSaving(true)
    try {
      // อัปโหลดไฟล์ก่อน (ถ้ามี)
      let fileUrl = uploadedUrl
      if (file && !uploadedUrl) {
        fileUrl = await uploadFile(jobCode.trim())
        if (file && !fileUrl) { setSaving(false); return }
      }

      const token = localStorage.getItem('token')
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          job_code: jobCode.trim(),
          drawing_name: drawingName,
          quantity,
          due_date: dueDate,
          status: 'กำลังดำเนินการ',
          processes: processes.filter((p) => p.process.trim()),
          file_url: fileUrl || null,
          file_name: file?.name || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'เกิดข้อผิดพลาด'); return }
      reset(); onOpenChange(false); onSuccess()
    } catch {
      setError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 bg-white border-0 font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#7B1A1A]" />
            เพิ่ม Job ย่อย
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            สร้าง Job ใต้ <span className="font-mono font-semibold text-gray-700">{parentId}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Job Code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Job Code <span className="text-red-500">*</span></Label>
            <Input value={jobCode} onChange={(e) => setJobCode(e.target.value)}
              placeholder={`${parentId}-001`} className="rounded-xl h-10 text-sm border-gray-200 font-mono" required />
            <p className="text-[10px] text-gray-400">รูปแบบ: {parentId}-XXX (L2) หรือ {parentId}-XXX-XX (L3)</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">ชื่อแบบ / DWG</Label>
            <Input value={drawingName} onChange={(e) => setDrawingName(e.target.value)}
              placeholder="เช่น LED Holder E-673-02" className="rounded-xl h-10 text-sm border-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">จำนวน (ชิ้น)</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl h-10 text-sm border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">กำหนดส่ง</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl h-10 text-sm border-gray-200" />
            </div>
          </div>

          {/* Processes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">ขั้นตอนการผลิต</Label>
              <button type="button" onClick={() => setProcesses([...processes, { process: '', person: '', target_time: '' }])}
                className="text-xs text-[#7B1A1A] hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> เพิ่มขั้นตอน
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {processes.map((p, i) => (
                <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-xl p-2.5">
                  <div className="flex-1 space-y-2">
                    <Input value={p.process} onChange={(e) => setProcesses(processes.map((r, j) => j === i ? { ...r, process: e.target.value } : r))}
                      placeholder="ชื่อขั้นตอน เช่น กลึง / กัด CNC" className="rounded-lg h-8 text-xs border-gray-200 bg-white" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={p.person} onChange={(e) => setProcesses(processes.map((r, j) => j === i ? { ...r, person: e.target.value } : r))}
                        placeholder="ผู้รับผิดชอบ" className="rounded-lg h-8 text-xs border-gray-200 bg-white" />
                      <Input value={p.target_time} onChange={(e) => setProcesses(processes.map((r, j) => j === i ? { ...r, target_time: e.target.value } : r))}
                        placeholder="เวลา HH:MM" className="rounded-lg h-8 text-xs border-gray-200 bg-white font-mono" />
                    </div>
                  </div>
                  {processes.length > 1 && (
                    <button type="button" onClick={() => setProcesses(processes.filter((_, j) => j !== i))}
                      className="p-1.5 text-gray-300 hover:text-red-400 mt-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── File upload ─── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">
              แนบไฟล์แบบ <span className="text-gray-400 font-normal">(PDF / STL / STEP / OBJ / 3MF — ไม่บังคับ)</span>
            </Label>

            <input ref={fileInputRef} type="file" accept=".pdf,.stl,.step,.stp,.obj,.3mf,.glb,.gltf"
              className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />

            {!file ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#7B1A1A]/40 hover:bg-red-50/20 transition-colors"
              >
                <Upload className="h-5 w-5 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">คลิกหรือลากไฟล์มาวาง</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                <FileIcon name={file.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
                  {uploadedUrl && (
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> อัปโหลดสำเร็จ
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => { setFile(null); setUploadedUrl(null); setUploadProgress(0) }}
                  className="p-1 rounded-full hover:bg-gray-200 text-gray-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>กำลังอัปโหลด...</span><span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#7B1A1A] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
            {fileError && <p className="text-[11px] text-red-500">{fileError}</p>}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <DialogFooter className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving || uploading}
              className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
            <Button type="submit" disabled={saving || uploading} className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6">
              {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploading ? 'กำลังอัปโหลด...' : 'สร้าง Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
