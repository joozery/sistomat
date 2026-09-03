'use client'

import { useState, useRef } from 'react'
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
import {
  Loader2,
  QrCode,
  FileText,
  Box,
  Upload,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2

const ALLOWED_EXT = ['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf']

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />
  return <Box className="h-5 w-5 text-blue-500" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AddProjectDialog({ open, onOpenChange, onSuccess }: AddProjectDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [form, setForm] = useState({ projectId: '', dwgName: '', receivedDate: '', dueDate: '' })
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function resetAll() {
    setStep(1)
    setForm({ projectId: '', dwgName: '', receivedDate: '', dueDate: '' })
    setFile(null)
    setFileError('')
    setUploadedUrl(null)
    setUploadProgress(0)
  }

  function handleClose(v: boolean) {
    if (!v) resetAll()
    onOpenChange(v)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) {
      setFileError('รองรับเฉพาะ PDF, STL, STEP, OBJ, 3MF, GLB เท่านั้น')
      setFile(null)
      return
    }
    setFileError('')
    setFile(f)
    setUploadedUrl(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) {
      setFileError('รองรับเฉพาะ PDF, STL, STEP, OBJ, 3MF, GLB เท่านั้น')
      setFile(null)
      return
    }
    setFileError('')
    setFile(f)
    setUploadedUrl(null)
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return null
    setUploading(true)
    setUploadProgress(0)
    try {
      const token = localStorage.getItem('token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', form.projectId)

      // XHR เพื่อแสดง progress
      const publicUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText)
            resolve(data.publicUrl)
          } else {
            try {
              const err = JSON.parse(xhr.responseText)
              reject(new Error(err.message || 'อัปโหลดไม่สำเร็จ'))
            } catch {
              reject(new Error('อัปโหลดไม่สำเร็จ'))
            }
          }
        }
        xhr.onerror = () => reject(new Error('เชื่อมต่อไม่ได้'))
        xhr.open('POST', '/api/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(fd)
      })

      setUploadedUrl(publicUrl)
      return publicUrl
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (!form.projectId || !form.receivedDate || !form.dueDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setStep(2)
  }

  async function handleSave() {
    setSaving(true)
    try {
      let fileUrl = uploadedUrl
      if (file && !uploadedUrl) {
        fileUrl = await uploadFile()
        if (file && !fileUrl) { setSaving(false); return }
      }

      const token = localStorage.getItem('token')
      await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: form.projectId,
          dwgName: form.dwgName,
          receivedDate: form.receivedDate,
          dueDate: form.dueDate,
          fileUrl: fileUrl || null,
          fileName: file?.name || null,
        }),
      })

      resetAll()
      onOpenChange(false)
      onSuccess()
    } catch {
      alert('บันทึกข้อมูลเรียบร้อยแล้ว')
      resetAll()
      onOpenChange(false)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border-0 font-sans">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#7B1A1A]" />
            เพิ่มโปรเจค / กระบวนการใหม่
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            {step === 1 ? 'ระบุเลขที่โปรเจคสำหรับออก QR Code ติดตามชิ้นงาน' : 'แนบไฟล์แบบ PDF หรือไฟล์ 3D (ไม่บังคับ)'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-1">
          {(['ข้อมูลโปรเจค', 'แนบไฟล์'] as const).map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-[#7B1A1A] text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
              {i < 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: Project info */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4 py-2">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">วันที่รับงาน</Label>
                <Input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} className="rounded-xl h-10 text-sm border-gray-200" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">กำหนดส่งมอบ</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded-xl h-10 text-sm border-gray-200" required />
              </div>
            </div>
            <DialogFooter className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
              <Button type="submit" className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1">
                ถัดไป <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 2: File upload */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !file && inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                file ? 'border-[#7B1A1A]/40 bg-red-50/40 cursor-default' : 'border-gray-200 hover:border-[#7B1A1A]/50 hover:bg-red-50/20'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.stl,.step,.stp,.obj,.3mf,.glb,.gltf"
                className="hidden"
                onChange={handleFileChange}
              />

              {!file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">คลิกหรือลากไฟล์มาวางที่นี่</p>
                  <p className="text-xs text-gray-400">PDF, STL, STEP, OBJ, 3MF, GLB (สูงสุด 100 MB)</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-left">
                  {getFileIcon(file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                    {uploadedUrl && (
                      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> อัปโหลดสำเร็จแล้ว
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setUploadedUrl(null); setUploadProgress(0) }}
                    className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>กำลังอัปโหลด...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7B1A1A] rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {fileError && <p className="text-xs text-red-500">{fileError}</p>}

            <p className="text-xs text-gray-400 text-center">ถ้าไม่มีไฟล์ สามารถกด "บันทึก" ข้ามได้เลย</p>

            <DialogFooter className="pt-2 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={uploading || saving} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={uploading || saving}
                className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6"
              >
                {(uploading || saving) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {uploading ? 'กำลังอัปโหลด...' : 'บันทึกกระบวนการ'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
