'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  AlertCircle,
  Hash,
} from 'lucide-react'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3

interface JobRowInput {
  id: string
  file: File
  drawingName: string
  jobCode: string
  level3: string
}

function deriveLevel1(code: string) {
  const m = code.match(/^(J[A-Z]-\d{3,4})/)
  return m ? m[1] : code
}

const ALLOWED_EXT = ['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf']

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500 shrink-0" />
  return <Box className="h-5 w-5 text-blue-500 shrink-0" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function stripExt(name: string) {
  return name.replace(/\.[^./\\]+$/, '')
}

function uploadOne(file: File, projectId: string, token: string | null, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('projectId', projectId)

    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
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
}

export function AddProjectDialog({ open, onOpenChange, onSuccess }: AddProjectDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [uploadIndex, setUploadIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [form, setForm] = useState({ projectId: '', receivedDate: '', dueDate: '' })
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [rows, setRows] = useState<JobRowInput[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function resetAll() {
    setStep(1)
    setForm({ projectId: '', receivedDate: '', dueDate: '' })
    setFiles([])
    setFileError('')
    setRows([])
    setSaveError('')
    setUploadingFileName('')
    setUploadIndex(0)
    setUploadProgress(0)
  }

  function handleClose(v: boolean) {
    if (!v) resetAll()
    onOpenChange(v)
  }

  function addFiles(list: File[]) {
    const valid: File[] = []
    let err = ''
    for (const f of list) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.includes(ext)) {
        err = 'รองรับเฉพาะ PDF, STL, STEP, OBJ, 3MF, GLB เท่านั้น'
        continue
      }
      valid.push(f)
    }
    setFileError(err)
    if (valid.length) setFiles((prev) => [...prev, ...valid])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleNext(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.projectId || !form.receivedDate || !form.dueDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setStep(2)
  }

  function goToJobAssign() {
    setRows(
      files.map((f, i) => ({
        id: `${f.name}-${i}-${f.lastModified}`,
        file: f,
        drawingName: stripExt(f.name),
        jobCode: '',
        level3: '',
      }))
    )
    setStep(3)
  }

  function updateRow(id: string, patch: Partial<JobRowInput>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function createProjectOnly() {
    setSaving(true)
    setSaveError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: form.projectId,
          dwgName: '',
          receivedDate: form.receivedDate,
          dueDate: form.dueDate,
          fileUrl: null,
          fileName: null,
        }),
      })
      if (!res.ok && res.status !== 409) {
        const data = await res.json()
        throw new Error(data.message || 'สร้างโปรเจคไม่สำเร็จ')
      }

      resetAll()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAll() {
    for (const r of rows) {
      if (!r.jobCode.trim()) {
        setSaveError(`กรุณากรอกหมายเลข JOB สำหรับไฟล์ "${r.file.name}"`)
        return
      }
    }

    setSaving(true)
    setSaveError('')
    const token = localStorage.getItem('token')

    try {
      const projRes = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: form.projectId,
          dwgName: '',
          receivedDate: form.receivedDate,
          dueDate: form.dueDate,
          fileUrl: null,
          fileName: null,
        }),
      })
      if (!projRes.ok && projRes.status !== 409) {
        const projData = await projRes.json()
        throw new Error(projData.message || 'สร้างโปรเจคไม่สำเร็จ')
      }

      const skippedJobCodes: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        setUploadIndex(i + 1)
        setUploadingFileName(r.file.name)
        setUploadProgress(0)

        const fileUrl = await uploadOne(r.file, form.projectId, token, setUploadProgress)

        const fullJobCode = r.level3.trim() || r.jobCode.trim()

        const jobRes = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            job_code: fullJobCode,
            drawing_name: r.drawingName.trim(),
            quantity: 1,
            due_date: form.dueDate,
            file_url: fileUrl,
            file_name: r.file.name,
          }),
        })
        if (!jobRes.ok) {
          if (jobRes.status === 409) {
            skippedJobCodes.push(fullJobCode)
            continue
          }
          const jobData = await jobRes.json()
          throw new Error(jobData.message || `สร้าง Job "${fullJobCode}" ไม่สำเร็จ`)
        }
      }

      const level1 = deriveLevel1(rows[0].jobCode.trim())
      resetAll()
      onOpenChange(false)
      onSuccess()
      if (skippedJobCodes.length) {
        alert(`ข้าม ${skippedJobCodes.length} Job ที่มีเลขซ้ำอยู่แล้ว: ${skippedJobCodes.join(', ')}`)
      }
      router.push(`/dashboard/job-list/${encodeURIComponent(level1)}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
      setUploadingFileName('')
    }
  }

  const stepLabels = ['ข้อมูลโปรเจค', 'แนบไฟล์', 'กำหนดเลข Job'] as const

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-6 bg-white border-0 font-sans max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#7B1A1A]" />
            เพิ่มโปรเจค / กระบวนการใหม่
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            {step === 1 && 'ระบุเลขที่โปรเจคสำหรับออก QR Code ติดตามชิ้นงาน'}
            {step === 2 && 'แนบไฟล์แบบ PDF หรือไฟล์ 3D ได้หลายไฟล์พร้อมกัน แต่ละไฟล์จะกลายเป็น Job ย่อย'}
            {step === 3 && 'กำหนดเลข Job และรหัสรุ่นให้แต่ละไฟล์ (สร้างทีหลังได้)'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-1 shrink-0">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors shrink-0 ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-[#7B1A1A] text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${step === i + 1 ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
              {i < stepLabels.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: Project info */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">เลขที่โปรเจค</Label>
              <Input
                placeholder="เช่น A-2917"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="rounded-xl h-10 text-sm border-gray-200"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">วันผลิต</Label>
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

        {/* Step 2: Multi-file upload */}
        {step === 2 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer border-gray-200 hover:border-[#7B1A1A]/50 hover:bg-red-50/20"
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.stl,.step,.stp,.obj,.3mf,.glb,.gltf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">คลิกหรือลากไฟล์มาวางที่นี่ (เลือกได้หลายไฟล์)</p>
                <p className="text-xs text-gray-400">PDF, STL, STEP, OBJ, 3MF, GLB (สูงสุด 100 MB ต่อไฟล์)</p>
              </div>
            </div>

            {fileError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" /> {fileError}
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">
                  ไฟล์ที่เลือก ({files.length}) — จะสร้างเป็น {files.length} Job ย่อย
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {files.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                      {getFileIcon(f.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={createProjectOnly}
                  disabled={saving}
                  className="rounded-full h-10 border-gray-200 text-gray-600"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  ข้ามไฟล์ / บันทึกโปรเจคอย่างเดียว
                </Button>
                <Button
                  type="button"
                  onClick={goToJobAssign}
                  disabled={files.length === 0}
                  className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1"
                >
                  ถัดไป <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>

            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Assign job codes */}
        {step === 3 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <p className="text-xs text-gray-400">
              แต่ละไฟล์จะกลายเป็น 1 Job ย่อย — ใส่หมายเลข JOB (บังคับ) และหมายเลข JOB ย่อยถ้ามี
            </p>

            <div className="space-y-3">
              {rows.map((r) => {
                const fullCode = r.level3.trim() || r.jobCode.trim()
                return (
                  <div key={r.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      {getFileIcon(r.file.name)}
                      <span className="text-xs text-gray-400 truncate">{r.file.name}</span>
                      {r.jobCode.trim() && (
                        <span className="ml-auto font-mono text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {fullCode}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-gray-600">ชื่อ Drawing</Label>
                      <Input
                        value={r.drawingName}
                        onChange={(e) => updateRow(r.id, { drawingName: e.target.value })}
                        className="rounded-lg h-9 text-sm border-gray-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <Hash className="h-3 w-3" /> หมายเลข JOB
                        </Label>
                        <Input
                          placeholder="เช่น JA-2917-001"
                          value={r.jobCode}
                          onChange={(e) => updateRow(r.id, { jobCode: e.target.value })}
                          className="rounded-lg h-9 text-sm border-gray-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <Hash className="h-3 w-3" /> หมายเลข JOB ย่อย <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                        </Label>
                        <Input
                          placeholder="เช่น JA-2917-001-02"
                          value={r.level3}
                          onChange={(e) => updateRow(r.id, { level3: e.target.value })}
                          className="rounded-lg h-9 text-sm border-gray-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {saving && uploadingFileName && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>กำลังอัปโหลด ({uploadIndex}/{rows.length}) — {uploadingFileName}</span>
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

            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError}
              </div>
            )}

            <DialogFooter className="pt-2 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={saving} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {saving ? 'กำลังบันทึก...' : `บันทึก ${rows.length} Job`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
