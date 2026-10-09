'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignBuCodes, changeBuCode, fetchBuJobs, normalizeBuCode, validateBuCodes } from '@/lib/bu-numbering'
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
  AlertTriangle,
  Layers,
} from 'lucide-react'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3

interface JobRowInput {
  id: string
  files: File[]
  drawingName: string
  jobCode: string
  level3: string
  level3Touched: boolean
  jobNote: string
  sender: string
  quantity: string
}

function deriveLevel1(code: string) {
  const m = code.match(/^([A-Z]+-\d{3,4})/)
  return m ? m[1] : code
}

// Job codes are always grouped under a "J" + letter prefix (e.g. "JA-2917") —
// auto-prepend it if someone types the bare form (e.g. "A-2917"), so the job
// hierarchy this creates always lines up with itself instead of splitting
// into two different level1 groups.
function normalizeJobCode(code: string) {
  const upper = code.toUpperCase()
  if (/^[A-Z]-/.test(upper) && !upper.startsWith('J')) return `J${upper}`
  return upper
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
  type SavePhase = 'idle' | 'uploading' | 'creating_project' | 'creating_jobs' | 'done'
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')
  const [saveStatus, setSaveStatus] = useState({
    uploadCurrent: 0,
    uploadTotal: 0,
    currentFileName: '',
    fileProgress: 0,
    jobCurrent: 0,
    jobTotal: 0,
    currentJobCode: '',
  })
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [uploadIndex, setUploadIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [form, setForm] = useState({ projectId: '', receivedDate: '', dueDate: '' })
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [rows, setRows] = useState<JobRowInput[]>([])
  const [batchSender, setBatchSender] = useState('')
  const [syncJobCode, setSyncJobCode] = useState(false)
  const [existingCodes, setExistingCodes] = useState<string[]>([])
  const [loadedCodeKey, setLoadedCodeKey] = useState<string | null>(null)
  const [codeLoadError, setCodeLoadError] = useState('')

  useEffect(() => {
    if (!saving) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saving])

  const overallProgressPercent = (() => {
    if (!saving) return 0
    if (savePhase === 'uploading') {
      if (saveStatus.uploadTotal === 0) return 15
      const fileFraction = Math.max(0, (saveStatus.uploadCurrent - 1 + (saveStatus.fileProgress / 100)) / saveStatus.uploadTotal)
      return Math.min(65, Math.max(5, Math.round(fileFraction * 65)))
    }
    if (savePhase === 'creating_project') return 70
    if (savePhase === 'creating_jobs') {
      if (saveStatus.jobTotal === 0) return 90
      const jobFraction = saveStatus.jobCurrent / saveStatus.jobTotal
      return Math.min(98, Math.round(70 + (jobFraction * 28)))
    }
    if (savePhase === 'done') return 100
    return 10
  })()

  const parentKey = JSON.stringify(Array.from(new Set(rows.map(row => deriveLevel1(normalizeBuCode(row.jobCode))).filter(code => /^[A-Z]+-\d{3,4}$/.test(code)))).sort())
  const checkingCodes = open && loadedCodeKey !== parentKey
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const parents: string[] = JSON.parse(parentKey)
    Promise.all(parents.map(parent => fetchBuJobs(parent, localStorage.getItem('token'))))
      .then(lists => {
        if (cancelled) return
        const codes = lists.flat().map(job => normalizeBuCode(job.job_code))
        setCodeLoadError('')
        setExistingCodes(codes)
        setRows(prev => assignBuCodes(prev, codes))
      })
      .catch(error => { if (!cancelled) setCodeLoadError(error.message) })
      .finally(() => { if (!cancelled) setLoadedCodeKey(parentKey) })
    return () => { cancelled = true }
  }, [open, parentKey])
  const inputRef = useRef<HTMLInputElement>(null)

  function resetAll() {
    setLoadedCodeKey(null)
    setStep(1)
    setForm({ projectId: '', receivedDate: '', dueDate: '' })
    setFiles([])
    setFileError('')
    setRows([])
    setBatchSender('')
    setSyncJobCode(false)
    setSaveError('')
    setSavePhase('idle')
    setSaveStatus({
      uploadCurrent: 0,
      uploadTotal: 0,
      currentFileName: '',
      fileProgress: 0,
      jobCurrent: 0,
      jobTotal: 0,
      currentJobCode: '',
    })
    setUploadingFileName('')
    setUploadIndex(0)
    setUploadProgress(0)
  }

  function handleClose(v: boolean) {
    if (saving) return
    if (!v) { resetAll(); setLoadedCodeKey(null) }
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
    const groups = new Map<string, File[]>()
    for (const f of files) {
      const base = stripExt(f.name)
      if (!groups.has(base)) groups.set(base, [])
      groups.get(base)!.push(f)
    }
    setRows(prev =>
      Array.from(groups.entries()).map(([base, groupFiles], i) => ({
        id: `${base}-${i}`,
        files: groupFiles,
        drawingName: base,
        jobCode: '',
        level3: '',
        level3Touched: false,
        jobNote: '',
        sender: batchSender,
        quantity: '1',
      })).map(row => {
        const old = prev.find(item => item.id === row.id)
        return old ? { ...old, files: row.files } : row
      })
    )
    setStep(3)
  }

  function updateRow(id: string, patch: Partial<JobRowInput>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const is3DFile = (name: string) =>
    ['stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf'].includes(
      name.split('.').pop()?.toLowerCase() ?? ''
    )

  async function createProjectOnly() {
    setSaving(true)
    setSaveError('')
    setSavePhase('uploading')
    setSaveStatus({
      uploadCurrent: 0,
      uploadTotal: files.length,
      currentFileName: '',
      fileProgress: 0,
      jobCurrent: 0,
      jobTotal: 0,
      currentJobCode: '',
    })
    try {
      const token = localStorage.getItem('token')
      const projectId = form.projectId.trim()
      const uploaded: { file_url: string; file_name: string }[] = []

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setSaveStatus(prev => ({
            ...prev,
            uploadCurrent: i + 1,
            currentFileName: file.name,
            fileProgress: 0,
          }))
          const url = await uploadOne(file, projectId, token, (pct) => {
            setSaveStatus(prev => ({ ...prev, fileProgress: pct }))
          })
          uploaded.push({ file_url: url, file_name: file.name })
        }
      }

      setSavePhase('creating_project')
      const primary = uploaded.find((f) => is3DFile(f.file_name)) ?? uploaded[0]

      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId,
          dwgName: '',
          receivedDate: form.receivedDate,
          dueDate: form.dueDate,
          fileUrl: primary?.file_url ?? null,
          fileName: primary?.file_name ?? null,
          attachments: uploaded.length ? uploaded : null,
        }),
      })
      if (!res.ok && res.status !== 409) {
        const data = await res.json()
        throw new Error(data.message || 'สร้างโปรเจคไม่สำเร็จ')
      }

      setSavePhase('done')
      resetAll()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
      setSavePhase('idle')
    }
  }

  async function handleSaveAll() {
    if (checkingCodes || codeLoadError) return
    const numberingError = validateBuCodes(rows, existingCodes)
    if (numberingError) { setSaveError(numberingError); return }
    for (const r of rows) {
      if (!r.jobCode.trim()) {
        setSaveError(`กรุณากรอกหมายเลข JOB สำหรับ "${r.drawingName}"`)
        return
      }
    }

    setSaving(true)
    setSaveError('')
    setSavePhase('uploading')

    const token = localStorage.getItem('token')
    const projectId = form.projectId.trim()

    try {
      const parents = Array.from(new Set(rows.map(row => deriveLevel1(normalizeBuCode(row.jobCode)))))
      const latest = (await Promise.all(parents.map(parent => fetchBuJobs(parent, token)))).flat().map(job => job.job_code)
      const conflict = validateBuCodes(rows, latest)
      if (conflict) { setExistingCodes(latest); throw new Error(conflict) }

      // จัดเตรียมคิวอัปโหลดไฟล์ทุกไฟล์
      const tasks: { rowIdx: number; file: File }[] = []
      rows.forEach((r, rowIdx) => {
        r.files.forEach((file) => {
          tasks.push({ rowIdx, file })
        })
      })

      const totalFiles = tasks.length
      setSaveStatus({
        uploadCurrent: 0,
        uploadTotal: totalFiles,
        currentFileName: tasks[0]?.file.name || '',
        fileProgress: 0,
        jobCurrent: 0,
        jobTotal: rows.length,
        currentJobCode: '',
      })

      const rowUploadsMap = new Map<number, { file_url: string; file_name: string }[]>()
      rows.forEach((_, idx) => rowUploadsMap.set(idx, []))

      // อัปโหลดแบบขนานทีละ 3 ไฟล์พร้อมกัน
      if (totalFiles > 0) {
        let taskCursor = 0
        let completedFiles = 0

        const poolSize = Math.min(3, totalFiles)
        const worker = async () => {
          while (taskCursor < tasks.length) {
            const currentIdx = taskCursor++
            const { rowIdx, file } = tasks[currentIdx]

            setSaveStatus(prev => ({
              ...prev,
              uploadCurrent: completedFiles + 1,
              currentFileName: file.name,
              fileProgress: 0,
            }))

            const url = await uploadOne(file, projectId, token, (pct) => {
              setSaveStatus(prev => (prev.currentFileName === file.name ? { ...prev, fileProgress: pct } : prev))
            })

            rowUploadsMap.get(rowIdx)!.push({ file_url: url, file_name: file.name })
            completedFiles++
            setSaveStatus(prev => ({
              ...prev,
              uploadCurrent: completedFiles,
              fileProgress: 100,
            }))
          }
        }

        await Promise.all(Array.from({ length: poolSize }, () => worker()))
      }

      // สร้างโปรเจกต์หลัก
      setSavePhase('creating_project')
      const allUploaded = Array.from(rowUploadsMap.values()).flat()
      const primaryProject = allUploaded.find((f) => is3DFile(f.file_name)) ?? allUploaded[0]

      const projRes = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId,
          dwgName: '',
          receivedDate: form.receivedDate,
          dueDate: form.dueDate,
          fileUrl: primaryProject?.file_url ?? null,
          fileName: primaryProject?.file_name ?? null,
          attachments: allUploaded.length ? allUploaded : null,
        }),
      })
      if (!projRes.ok && projRes.status !== 409) {
        const projData = await projRes.json()
        throw new Error(projData.message || 'สร้างโปรเจคไม่สำเร็จ')
      }

      // ทยอยสร้าง Job ย่อย
      setSavePhase('creating_jobs')
      const skippedJobCodes: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const uploaded = rowUploadsMap.get(i) ?? []
        const primary = uploaded.find((f) => is3DFile(f.file_name)) ?? uploaded[0]
        const fullJobCode = normalizeJobCode(r.level3.trim() || r.jobCode.trim())

        setSaveStatus(prev => ({
          ...prev,
          jobCurrent: i + 1,
          jobTotal: rows.length,
          currentJobCode: `${fullJobCode}${r.drawingName ? ` (${r.drawingName})` : ''}`,
        }))

        const jobRes = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            job_code: fullJobCode,
            job_note: r.jobNote.trim(),
            sender: r.sender.trim(),
            drawing_name: r.drawingName.trim(),
            quantity: Number(r.quantity) || 1,
            received_date: form.receivedDate,
            due_date: form.dueDate,
            file_url: primary?.file_url ?? null,
            file_name: primary?.file_name ?? null,
            attachments: uploaded.length ? uploaded : null,
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

      setSavePhase('done')
      const level1 = deriveLevel1(normalizeJobCode(rows[0].jobCode.trim()))
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
      setSavePhase('idle')
    }
  }

  const stepLabels = ['ข้อมูลโปรเจค', 'แนบไฟล์', 'กำหนดเลข Job'] as const

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onInteractOutside={(e) => {
          if (saving) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault()
        }}
        className="sm:max-w-3xl rounded-2xl p-6 bg-white border-0 font-sans max-h-[90vh] flex flex-col scrollbar-hide overflow-hidden"
      >
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
          <>
            <div className="space-y-4 py-2 flex-1 overflow-y-auto scrollbar-hide">
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
                  {(() => {
                    const jobCount = new Set(files.map((f) => stripExt(f.name))).size
                    return (
                      <p className="text-xs font-semibold text-gray-600">
                        ไฟล์ที่เลือก ({files.length}) — จะสร้างเป็น{' '}
                        <span className="text-[#7B1A1A]">{jobCount} Job ย่อย</span>
                        {jobCount < files.length && (
                          <span className="text-gray-400 font-normal"> (ไฟล์ชื่อเดียวกันรวมเป็น Job เดียว)</span>
                        )}
                      </p>
                    )
                  })()}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
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
            </div>

            {(saveError || codeLoadError) && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError || codeLoadError}
              </div>
            )}

            <DialogFooter className="flex justify-between gap-2">
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
                  {files.length > 0 ? 'บันทึกโปรเจคพร้อมไฟล์ที่แนบ' : 'ข้ามไฟล์ / บันทึกโปรเจคอย่างเดียว'}
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
          </>
        )}

        {/* Step 3: Assign job codes */}
        {step === 3 && (
          <>
            <div className="space-y-4 py-2 flex-1 overflow-y-auto scrollbar-hide">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  แต่ละไฟล์จะกลายเป็น 1 Job ย่อย — ใส่หมายเลข JOB (บังคับ) และหมายเลข JOB ย่อยถ้ามี
                </p>
                {rows.length > 1 && (
                  <label className="flex items-center gap-2 cursor-pointer shrink-0 ml-3">
                    <div
                      onClick={() => {
                        const next = !syncJobCode
                        setSyncJobCode(next)
                        if (next && rows[0]?.jobCode.trim()) {
                          const base = rows[0].jobCode.trim()
                          setRows(prev => assignBuCodes(prev.map(row => ({ ...row, jobCode: base })), existingCodes))
                        }
                      }}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${syncJobCode ? 'bg-[#7B1A1A]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${syncJobCode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 whitespace-nowrap">ใช้เลข JOB เดียวกันทุกแถว</span>
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-[#7B1A1A]/20 bg-red-50/40 p-3 space-y-1.5">
                <Label className="text-[11px] font-semibold text-gray-700">ผู้สั่งงาน (ใช้กับทุก Job ในรอบนี้)</Label>
                <Input
                  placeholder="ชื่อผู้สั่งงาน"
                  value={batchSender}
                  onChange={(e) => {
                    const value = e.target.value
                    setBatchSender(value)
                    setRows(prev => prev.map(row => ({ ...row, sender: value })))
                  }}
                  className="rounded-lg h-9 text-sm border-gray-200 bg-white"
                />
                <p className="text-[11px] text-gray-500">ชื่อจะถูกบันทึกให้ Job ย่อยทุกตัวที่เพิ่มในรอบนี้</p>
              </div>

              <p className="text-xs text-gray-500">แก้ BU แถวแรกของกลุ่มเพื่อรันแถวถัดไปอัตโนมัติ โดยข้ามเลขที่ใช้แล้ว{checkingCodes ? ' — กำลังตรวจเลขเดิม...' : ''}</p>
              <div className="space-y-3">
                {rows.map((r, rowIdx) => {
                  const fullCode = r.level3.trim() || r.jobCode.trim()
                  return (
                    <div key={r.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.files.map((f) => (
                          <div key={f.name} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                            {getFileIcon(f.name)}
                            <span className="text-xs text-gray-500 truncate max-w-[180px]">{f.name}</span>
                          </div>
                        ))}
                        {r.jobCode.trim() && (
                          <span className="ml-auto font-mono text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
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

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> หมายเลข JOB
                          </Label>
                          <Input
                            placeholder="เช่น JA-2917-001"
                            value={r.jobCode}
                            disabled={syncJobCode && rowIdx > 0}
                            onChange={(e) => {
                              const code = e.target.value
                              setRows(prev => assignBuCodes(prev.map(row =>
                                syncJobCode || row.id === r.id ? { ...row, jobCode: code } : row
                              ), existingCodes))
                            }}
                            className={`rounded-lg h-9 text-sm border-gray-200 font-mono ${syncJobCode && rowIdx > 0 ? 'bg-gray-50 text-gray-400' : ''}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> หมายเลข JOB ย่อย <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                          </Label>
                          <Input
                            placeholder="auto จาก JOB"
                            value={r.level3}
                            onChange={(e) => setRows(prev => changeBuCode(prev, r.id, e.target.value, existingCodes))}
                            className={`rounded-lg h-9 text-sm border-gray-200 font-mono ${!r.level3Touched && r.level3 ? 'text-emerald-700 bg-emerald-50/50' : ''}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600">หมายเหตุ</Label>
                          <Input
                            placeholder="เช่น ตัดแมท"
                            value={r.jobNote}
                            onChange={(e) => updateRow(r.id, { jobNote: e.target.value })}
                          className="rounded-lg h-9 text-sm border-gray-200"
                        />
                      </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600">จำนวน</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={r.quantity}
                            onChange={(e) => updateRow(r.id, { quantity: e.target.value })}
                            className="rounded-lg h-9 text-sm border-gray-200"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {(saveError || codeLoadError) && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError || codeLoadError}
              </div>
            )}

            <DialogFooter className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={saving} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || checkingCodes || Boolean(codeLoadError)}
                className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {saving ? 'กำลังบันทึก...' : `บันทึก ${rows.length} Job`}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Processing & Lock Overlay */}
        {saving && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
            <div className="max-w-md w-full flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-red-100 animate-ping opacity-60" />
                <div className="relative w-16 h-16 rounded-full bg-red-50 border-2 border-[#7B1A1A]/30 flex items-center justify-center shadow-inner">
                  {savePhase === 'uploading' && <Upload className="h-8 w-8 text-[#7B1A1A] animate-bounce" />}
                  {savePhase === 'creating_project' && <Layers className="h-8 w-8 text-[#7B1A1A] animate-pulse" />}
                  {savePhase === 'creating_jobs' && <Loader2 className="h-8 w-8 text-[#7B1A1A] animate-spin" />}
                  {savePhase === 'done' && <CheckCircle2 className="h-8 w-8 text-emerald-600" />}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-800 tracking-tight">
                  {savePhase === 'uploading' && `กำลังอัปโหลดไฟล์ Drawing (${saveStatus.uploadCurrent}/${saveStatus.uploadTotal})`}
                  {savePhase === 'creating_project' && 'กำลังสร้างโฟลเดอร์โปรเจกต์หลักในระบบ'}
                  {savePhase === 'creating_jobs' && `กำลังสร้าง Job ย่อย (${saveStatus.jobCurrent}/${saveStatus.jobTotal})`}
                  {savePhase === 'done' && 'เสร็จสิ้นเรียบร้อย'}
                </h3>
                <p className="text-xs text-gray-500 font-mono truncate max-w-sm">
                  {savePhase === 'uploading' && (saveStatus.currentFileName || 'กำลังเตรียมส่งไฟล์...')}
                  {savePhase === 'creating_project' && `รหัสโปรเจกต์: ${form.projectId.trim()}`}
                  {savePhase === 'creating_jobs' && `รหัส Job: ${saveStatus.currentJobCode || '...'}`}
                  {savePhase === 'done' && 'กำลังเปิดหน้ารายการ...'}
                </p>
              </div>

              <div className="w-full space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                  <span>ความคืบหน้ารวม</span>
                  <span className="text-[#7B1A1A] font-mono">{overallProgressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                  <div
                    className="h-full bg-gradient-to-r from-[#7B1A1A] to-[#a32a2a] rounded-full transition-all duration-300"
                    style={{ width: `${overallProgressPercent}%` }}
                  />
                </div>
              </div>

              {savePhase === 'uploading' && saveStatus.uploadTotal > 0 && (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-left space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span className="truncate max-w-[240px] font-medium">{saveStatus.currentFileName}</span>
                    <span className="font-mono">{saveStatus.fileProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7B1A1A] rounded-full transition-all duration-200"
                      style={{ width: `${saveStatus.fileProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3 flex items-start gap-2.5 text-left text-amber-900 mt-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">กรุณารอสักครู่ ห้ามปิดหน้าต่างหรือรีเฟรชเบราว์เซอร์:</span> ระบบกำลังประมวลผลไฟล์ Drawing และเชื่อมโยงฐานข้อมูลการผลิต
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
