'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2, Plus, Layers, Upload, FileText, Box, X,
  CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, Hash,
} from 'lucide-react'

interface AddJobDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  parentId: string
  onSuccess: () => void
}

interface BuRow {
  id: string
  files: File[]
  drawingName: string
  jobCode: string       // level2
  level3: string        // level3 (auto or manual)
  level3Touched: boolean
}

type Step = 1 | 2 | 3

const ALLOWED_EXT = ['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf']

function stripExt(name: string) {
  return name.replace(/\.[^./\\]+$/, '')
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

function suggestLevel2(parentId: string, existingCodes: string[]): string {
  const nums = existingCodes
    .map((c) => c.match(/^J[A-Z]-\d{3,4}-(\d{3})$/)?.[1])
    .filter(Boolean).map(Number)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${parentId}-${String(next).padStart(3, '0')}`
}

function uploadOne(
  file: File,
  projectId: string,
  token: string | null,
  onProgress: (pct: number) => void,
): Promise<string> {
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
}

export function AddJobDialog({ open, onOpenChange, parentId, onSuccess }: AddJobDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Step 1 fields
  const [jobCode, setJobCode] = useState('')   // level2 base (e.g. JA-0298-002)
  const [dueDate, setDueDate] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [coating, setCoating] = useState('')
  const [outsource, setOutsource] = useState('')

  // Step 2 files
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3 BU rows
  const [rows, setRows] = useState<BuRow[]>([])
  const [syncCode, setSyncCode] = useState(false)

  // Upload progress
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [uploadIndex, setUploadIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('token')
    fetch(`/api/jobs?level1=${encodeURIComponent(parentId)}&limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const jobs = Array.isArray(data) ? data : (data.jobs ?? [])
        setJobCode(suggestLevel2(parentId, jobs.map((j: { job_code: string }) => j.job_code)))
      })
      .catch(() => setJobCode(`${parentId}-001`))
  }, [open, parentId])

  function reset() {
    setStep(1); setSaving(false); setSaveError('')
    setJobCode(''); setDueDate(''); setQuantity('1'); setCoating(''); setOutsource('')
    setFiles([]); setFileError(''); setRows([]); setSyncCode(false)
    setUploadingFileName(''); setUploadIndex(0); setUploadProgress(0)
  }

  function handleClose(v: boolean) { if (!v) reset(); onOpenChange(v) }

  // ── File helpers ──
  function addFiles(list: File[]) {
    const valid: File[] = []; let err = ''
    for (const f of list) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.includes(ext)) { err = 'รองรับเฉพาะ PDF, STL, STEP, OBJ, 3MF, GLB'; continue }
      valid.push(f)
    }
    setFileError(err)
    if (valid.length) setFiles((prev) => [...prev, ...valid.filter(v => !prev.some(p => p.name === v.name))])
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Step navigation ──
  function goStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!jobCode.trim()) return
    setSaveError('')
    setStep(2)
  }

  function goStep3() {
    // group files by base name
    const groups = new Map<string, File[]>()
    for (const f of files) {
      const base = stripExt(f.name)
      if (!groups.has(base)) groups.set(base, [])
      groups.get(base)!.push(f)
    }
    const buRows: BuRow[] = Array.from(groups.entries()).map(([base, grpFiles], i) => ({
      id: `${base}-${i}`,
      files: grpFiles,
      drawingName: base,
      jobCode: jobCode.trim(),
      level3: `${jobCode.trim()}-${String(i + 1).padStart(2, '0')}`,
      level3Touched: false,
    }))
    setRows(buRows)
    setStep(3)
  }

  function updateRow(id: string, patch: Partial<BuRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  // ── Save all ──
  const is3D = (name: string) =>
    ['stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf'].includes(name.split('.').pop()?.toLowerCase() ?? '')

  async function handleSaveAll() {
    for (const r of rows) {
      if (!r.level3.trim() && !r.jobCode.trim()) {
        setSaveError(`กรุณากรอกเลข BU สำหรับ "${r.drawingName}"`)
        return
      }
    }
    setSaving(true); setSaveError('')
    const token = localStorage.getItem('token')
    const skipped: string[] = []

    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        setUploadIndex(i + 1); setUploadProgress(0)

        const uploaded: { file_url: string; file_name: string }[] = []
        for (const file of r.files) {
          setUploadingFileName(file.name); setUploadProgress(0)
          const url = await uploadOne(file, parentId, token, setUploadProgress)
          uploaded.push({ file_url: url, file_name: file.name })
        }

        const primary = uploaded.find((f) => is3D(f.file_name)) ?? uploaded[0]
        const fullCode = r.level3.trim() || r.jobCode.trim()

        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            job_code: fullCode,
            drawing_name: r.drawingName.trim(),
            quantity: Number(quantity) || 1,
            due_date: dueDate,
            status: 'กำลังดำเนินการ',
            coating,
            outsource_process: outsource,
            file_url: primary?.file_url ?? null,
            file_name: primary?.file_name ?? null,
            attachments: uploaded,
          }),
        })

        if (!res.ok) {
          if (res.status === 409) { skipped.push(fullCode); continue }
          const d = await res.json()
          throw new Error(d.message || `สร้าง "${fullCode}" ไม่สำเร็จ`)
        }
      }

      reset(); onOpenChange(false); onSuccess()
      if (skipped.length) alert(`ข้าม ${skipped.length} Job ที่มีเลขซ้ำ: ${skipped.join(', ')}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false); setUploadingFileName('')
    }
  }

  // ── Save without files (step 2 skip) ──
  async function saveWithoutFiles() {
    setSaving(true); setSaveError('')
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          job_code: jobCode.trim(),
          drawing_name: '',
          quantity: Number(quantity) || 1,
          due_date: dueDate,
          status: 'กำลังดำเนินการ',
          coating,
          outsource_process: outsource,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'เกิดข้อผิดพลาด')
      reset(); onOpenChange(false); onSuccess()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const stepLabels = ['ข้อมูล Job', 'แนบไฟล์', 'กำหนดเลข BU'] as const

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-6 bg-white border-0 font-sans max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#7B1A1A]" />
            เพิ่ม Job ย่อย
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            สร้าง Job ใต้ <span className="font-mono font-semibold text-gray-700">{parentId}</span>
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

        {/* ── Step 1: ข้อมูล Job ── */}
        {step === 1 && (
          <form onSubmit={goStep2} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Job Code (Level 2) <span className="text-red-500">*</span></Label>
              <Input
                value={jobCode} onChange={(e) => setJobCode(e.target.value)}
                placeholder={`${parentId}-001`}
                className="rounded-xl h-10 text-sm border-gray-200 font-mono"
                required
              />
              <p className="text-[10px] text-gray-400">รูปแบบ: {parentId}-XXX</p>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Coating / ชุบ</Label>
                <Input value={coating} onChange={(e) => setCoating(e.target.value)} placeholder="เช่น Black Anodize" className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Outsource Process</Label>
                <Input value={outsource} onChange={(e) => setOutsource(e.target.value)} placeholder="เช่น ชุบนอก" className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
            </div>

            <DialogFooter className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
              <Button type="submit" className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1">
                ถัดไป <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Step 2: แนบไฟล์ ── */}
        {step === 2 && (
          <>
            <div className="space-y-4 py-2 flex-1 overflow-y-auto">
              <input
                ref={fileInputRef} type="file" multiple
                accept=".pdf,.stl,.step,.stp,.obj,.3mf,.glb,.gltf"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)) }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer border-gray-200 hover:border-[#7B1A1A]/50 hover:bg-red-50/20 transition-colors"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">คลิกหรือลากไฟล์มาวาง (เลือกได้หลายไฟล์)</p>
                  <p className="text-xs text-gray-400">PDF, STL, STEP, OBJ, 3MF, GLB — ไฟล์ชื่อเดียวกันรวมเป็น BU เดียว</p>
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
                    ไฟล์ที่เลือก ({files.length}) — จะสร้างเป็น{' '}
                    <span className="text-[#7B1A1A]">{new Set(files.map((f) => stripExt(f.name))).size} BU</span>
                  </p>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {files.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                        <FileIcon name={f.name} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
                          <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                        </div>
                        <button type="button" onClick={() => removeFile(idx)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError}
              </div>
            )}

            <DialogFooter className="flex justify-between gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={saveWithoutFiles} disabled={saving} className="rounded-full h-10 border-gray-200 text-gray-600 text-xs">
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  ข้ามไฟล์ / บันทึกอย่างเดียว
                </Button>
                <Button type="button" onClick={goStep3} disabled={files.length === 0} className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 gap-1">
                  ถัดไป <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: กำหนดเลข BU ── */}
        {step === 3 && (
          <>
            <div className="space-y-4 py-2 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">แต่ละกลุ่มไฟล์จะกลายเป็น 1 BU — ตรวจสอบและแก้เลขได้</p>
                {rows.length > 1 && (
                  <label className="flex items-center gap-2 cursor-pointer shrink-0 ml-3">
                    <div
                      onClick={() => {
                        const next = !syncCode; setSyncCode(next)
                        if (next && rows[0]?.jobCode.trim()) {
                          const base = rows[0].jobCode.trim()
                          setRows((prev) => prev.map((r, i) => ({
                            ...r, jobCode: base,
                            level3: r.level3Touched ? r.level3 : `${base}-${String(i + 1).padStart(2, '0')}`,
                          })))
                        }
                      }}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${syncCode ? 'bg-[#7B1A1A]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${syncCode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 whitespace-nowrap">ใช้เลข Job เดียวกันทุกแถว</span>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                {rows.map((r, rowIdx) => {
                  const fullCode = r.level3.trim() || r.jobCode.trim()
                  return (
                    <div key={r.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.files.map((f) => (
                          <div key={f.name} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                            <FileIcon name={f.name} />
                            <span className="text-xs text-gray-500 truncate max-w-[180px]">{f.name}</span>
                          </div>
                        ))}
                        {fullCode && (
                          <span className="ml-auto font-mono text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                            {fullCode}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-gray-600">ชื่อ Drawing</Label>
                        <Input value={r.drawingName} onChange={(e) => updateRow(r.id, { drawingName: e.target.value })} className="rounded-lg h-9 text-sm border-gray-200" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> Level 2 (Job)
                          </Label>
                          <Input
                            placeholder={`${parentId}-001`}
                            value={r.jobCode}
                            disabled={syncCode && rowIdx > 0}
                            onChange={(e) => {
                              const code = e.target.value
                              if (syncCode) {
                                setRows((prev) => prev.map((row, i) => ({
                                  ...row, jobCode: code,
                                  level3: row.level3Touched ? row.level3 : code.trim() ? `${code.trim()}-${String(i + 1).padStart(2, '0')}` : '',
                                })))
                              } else {
                                const patch: Partial<BuRow> = { jobCode: code }
                                if (!r.level3Touched) patch.level3 = code.trim() ? `${code.trim()}-${String(rowIdx + 1).padStart(2, '0')}` : ''
                                updateRow(r.id, patch)
                              }
                            }}
                            className={`rounded-lg h-9 text-sm border-gray-200 font-mono ${syncCode && rowIdx > 0 ? 'bg-gray-50 text-gray-400' : ''}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> Level 3 (BU) <span className="text-gray-400 font-normal">(auto)</span>
                          </Label>
                          <Input
                            placeholder="auto"
                            value={r.level3}
                            onChange={(e) => updateRow(r.id, { level3: e.target.value, level3Touched: true })}
                            className={`rounded-lg h-9 text-sm border-gray-200 font-mono ${!r.level3Touched && r.level3 ? 'text-emerald-700 bg-emerald-50/50' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {saving && uploadingFileName && (
              <div className="space-y-1 shrink-0">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>BU {uploadIndex}/{rows.length} — {uploadingFileName}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#7B1A1A] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" /> {saveError}
              </div>
            )}

            <DialogFooter className="flex justify-between gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={saving} className="rounded-full h-10 border-gray-200 gap-1">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <Button type="button" onClick={handleSaveAll} disabled={saving} className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                {saving ? 'กำลังบันทึก...' : `บันทึก ${rows.length} BU`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
