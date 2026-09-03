'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Upload,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Table2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessEntry {
  process: string
  person: string
  time_hours: number
}

export interface JobRow {
  seq: number
  date: string
  job_code: string
  level1: string
  level2: string | null
  level3: string | null
  drawing_name: string
  quantity: number
  completed: number
  remaining: number
  status: string
  processes: ProcessEntry[]
  total_time: number
  outsource_process: string
  coating: string
  sender: string
  due_date: string
  actual_completion_date: string
  receiver: string
  received_date: string
  sheet_name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLevels(jobCode: string): { level1: string; level2: string | null; level3: string | null } {
  // Strip Thai/English suffixes like _Modify, _ตัดแมท
  const clean = jobCode.replace(/_[A-Za-zก-๙\s]+.*$/, '')
  // Pattern: J[X]-NNNN, J[X]-NNNN-NNN, J[X]-NNNN-NNN-NN
  const m = clean.match(/^(J[A-Z]-\d{3,4})(-\d{3})?(-\d{2})?$/)
  if (!m) return { level1: jobCode, level2: null, level3: null }
  const l1 = m[1]
  const l2base = m[2] ? l1 + m[2] : null
  if (m[3] && l2base) {
    // Has all 3 levels — L3 keeps original jobCode
    return { level1: l1, level2: l2base, level3: jobCode }
  }
  if (l2base) {
    // Only L1+L2 — L2 keeps original jobCode (with suffix)
    return { level1: l1, level2: jobCode, level3: null }
  }
  return { level1: l1, level2: null, level3: null }
}

function excelDateToISO(serial: unknown): string {
  const n = Number(serial)
  if (!n || n < 1000) return ''
  const date = new Date((n - 25569) * 86400 * 1000)
  return date.toISOString().split('T')[0]
}

function toStr(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseMainSheet(rows: unknown[][], sheetName: string): JobRow[] {
  const jobs: JobRow[] = []
  // rows 0=title, 1-2=headers → data starts at row 3
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    const jobCode = toStr(r[2])
    if (!jobCode || !/^J[A-Z]-/i.test(jobCode)) continue

    const processes: ProcessEntry[] = []
    const addProcess = (pi: number, ri: number, ti: number) => {
      const p = toStr(r[pi])
      if (p) processes.push({ process: p, person: toStr(r[ri]), time_hours: toNum(r[ti]) })
    }
    addProcess(8, 9, 10)
    addProcess(11, 12, 13)
    addProcess(14, 15, 16)
    addProcess(17, 18, 19)

    const { level1, level2, level3 } = parseLevels(jobCode)
    jobs.push({
      seq: toNum(r[0]),
      date: excelDateToISO(r[1]),
      job_code: jobCode,
      level1,
      level2,
      level3,
      drawing_name: toStr(r[3]),
      quantity: toNum(r[4]),
      completed: toNum(r[5]),
      remaining: toNum(r[6]),
      status: toStr(r[7]),
      processes,
      total_time: toNum(r[20]),
      outsource_process: [toStr(r[21]), toStr(r[22])].filter(Boolean).join(' / '),
      coating: toStr(r[23]),
      sender: toStr(r[24]),
      due_date: excelDateToISO(r[25]),
      actual_completion_date: excelDateToISO(r[26]),
      receiver: toStr(r[27]),
      received_date: excelDateToISO(r[28]),
      sheet_name: sheetName,
    })
  }
  return jobs
}

function parseProjectSheet(rows: unknown[][], sheetName: string): JobRow[] {
  const jobs: JobRow[] = []
  // row 0 = header (No., JOB, Draw., Qty., Process, Outside, coating, Due date, ...)
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    const jobCode = toStr(r[1])
    if (!jobCode || !r[0]) continue

    const { level1, level2, level3 } = parseLevels(jobCode)
    jobs.push({
      seq: toNum(r[0]),
      date: '',
      job_code: jobCode,
      level1: level1 || sheetName,
      level2: level2,
      level3: level3,
      drawing_name: toStr(r[2]),
      quantity: toNum(r[3]),
      completed: 0,
      remaining: toNum(r[3]),
      status: toStr(r[9]),
      processes: r[4] ? [{ process: toStr(r[4]), person: '', time_hours: 0 }] : [],
      total_time: 0,
      outsource_process: toStr(r[5]),
      coating: toStr(r[6]),
      sender: '',
      due_date: excelDateToISO(r[7]),
      actual_completion_date: '',
      receiver: '',
      received_date: '',
      sheet_name: sheetName,
    })
  }
  return jobs
}

function detectAndParse(rows: unknown[][], sheetName: string): JobRow[] {
  if (!rows || rows.length < 2) return []
  const firstCell = toStr(rows[0]?.[0])
  if (firstCell.includes('Status On Plan') || firstCell === 'ลำดับ') {
    return parseMainSheet(rows, sheetName)
  }
  if (firstCell === 'No.' || firstCell === 'No') {
    return parseProjectSheet(rows, sheetName)
  }
  return []
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ImportExcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3

const SKIP_SHEETS = ['Template', 'Sheet2', 'sheet2']

export function ImportExcelDialog({ open, onOpenChange, onSuccess }: ImportExcelDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [parsing, setParsing] = useState(false)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [grouped, setGrouped] = useState<Record<string, JobRow[]>>({})
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; updated: number; total: number } | null>(null)
  const [error, setError] = useState<string>('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep(1)
    setFile(null)
    setSheets([])
    setSelectedSheet('')
    setJobs([])
    setGrouped({})
    setExpandedGroups(new Set())
    setResult(null)
    setError('')
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(reset, 300)
  }

  const loadSheets = async (f: File) => {
    setError('')
    setFile(f)
    try {
      const XLSX = await import('xlsx')
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const available = wb.SheetNames.filter((n: string) => !SKIP_SHEETS.includes(n))
      setSheets(available)
      setSelectedSheet(available[0] ?? '')
    } catch {
      setError('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx')
    }
  }

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) loadSheets(f)
    },
    []
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadSheets(f)
  }

  const handleParse = async () => {
    if (!file || !selectedSheet) return
    setParsing(true)
    setError('')
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const ws = wb.Sheets[selectedSheet]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      const parsed = detectAndParse(rows, selectedSheet)
      if (parsed.length === 0) {
        setError('ไม่พบข้อมูลในชีตนี้ หรือรูปแบบไม่รองรับ')
        return
      }
      const grp: Record<string, JobRow[]> = {}
      for (const j of parsed) {
        if (!grp[j.level1]) grp[j.level1] = []
        grp[j.level1].push(j)
      }
      setJobs(parsed)
      setGrouped(grp)
      setStep(2)
    } catch {
      setError('เกิดข้อผิดพลาดในการอ่านข้อมูล')
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobs),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
      setStep(3)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setImporting(false)
    }
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-0 bg-white border-0 font-sans overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <DialogTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#7B1A1A]" />
            นำเข้าข้อมูลจาก Excel
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400 mt-0.5">
            รองรับไฟล์ Work Schedule .xlsx — JAN / FEB / Project sheet
          </DialogDescription>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { n: 1, label: 'เลือกไฟล์' },
              { n: 2, label: 'ตรวจสอบข้อมูล' },
              { n: 3, label: 'นำเข้าสำเร็จ' },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      step >= n
                        ? 'bg-[#7B1A1A] text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step > n ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                  </div>
                  <span className={`text-[11px] font-medium ${step >= n ? 'text-gray-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && <div className="h-px w-8 bg-gray-200" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-10 ${
                  dragging
                    ? 'border-[#7B1A1A] bg-red-50'
                    : file
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/50'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileInput}
                />
                {file ? (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-400">คลิกเพื่อเปลี่ยนไฟล์</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-300" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600">ลากไฟล์มาวางที่นี่</p>
                      <p className="text-xs text-gray-400 mt-0.5">หรือคลิกเพื่อเลือกไฟล์ .xlsx</p>
                    </div>
                  </>
                )}
              </div>

              {/* Sheet selector */}
              {sheets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">เลือก Sheet ที่ต้องการนำเข้า</p>
                  <div className="flex flex-wrap gap-2">
                    {sheets.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSheet(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          selectedSheet === s
                            ? 'bg-[#7B1A1A] text-white border-[#7B1A1A]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Table2 className="inline h-3 w-3 mr-1 -mt-0.5" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  พบ <span className="text-gray-800">{jobs.length}</span> รายการ ใน{' '}
                  <span className="text-gray-800">{Object.keys(grouped).length}</span> JOB หลัก
                </p>
                <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                  Sheet: {selectedSheet}
                </span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {Object.entries(grouped).map(([parentJob, items]) => {
                  const isOpen = expandedGroups.has(parentJob)
                  const preview = items.slice(0, 4)
                  return (
                    <div key={parentJob} className="rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => toggleGroup(parentJob)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-mono font-bold text-sm text-gray-800">{parentJob}</span>
                          <span className="text-[11px] bg-[#7B1A1A]/10 text-[#7B1A1A] px-2 py-0.5 rounded-full font-semibold">
                            {items.length} รายการ
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {[...new Set(items.flatMap((j) => j.processes.map((p) => p.process)).filter(Boolean))].slice(0, 3).map((p) => (
                            <span key={p} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
                              {p}
                            </span>
                          ))}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="divide-y divide-gray-100">
                          {preview.map((job) => (
                            <div key={job.job_code} className="px-4 py-2.5 flex items-start justify-between gap-4 hover:bg-gray-50/50">
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-semibold text-gray-700 truncate">{job.job_code}</p>
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">{job.drawing_name}</p>
                              </div>
                              <div className="shrink-0 flex items-center gap-3 text-right">
                                <div>
                                  <p className="text-[10px] text-gray-400">จำนวน</p>
                                  <p className="text-xs font-bold text-gray-700">{job.quantity} ชิ้น</p>
                                </div>
                                {job.due_date && (
                                  <div>
                                    <p className="text-[10px] text-gray-400">กำหนดส่ง</p>
                                    <p className="text-xs font-medium text-gray-600">{job.due_date}</p>
                                  </div>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  job.status === 'ครบ' || job.status === 'รับแล้ว'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {job.status || '-'}
                                </span>
                              </div>
                            </div>
                          ))}
                          {items.length > 4 && (
                            <div className="px-4 py-2 text-center text-[11px] text-gray-400 bg-gray-50">
                              ...และอีก {items.length - 4} รายการ
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && result && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">นำเข้าข้อมูลสำเร็จ!</p>
                <p className="text-sm text-gray-500 mt-1">
                  เพิ่มใหม่ <span className="font-bold text-gray-800">{result.inserted}</span> รายการ ·
                  อัปเดต <span className="font-bold text-gray-800">{result.updated}</span> รายการ ·
                  รวม <span className="font-bold text-gray-800">{result.total}</span> รายการ
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center shrink-0 bg-gray-50/40">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose} className="rounded-full h-9 border-gray-200 text-sm">
                ยกเลิก
              </Button>
              <Button
                onClick={handleParse}
                disabled={!file || !selectedSheet || parsing}
                className="rounded-full h-9 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 text-sm"
              >
                {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {parsing ? 'กำลังอ่านข้อมูล...' : 'อ่านข้อมูล'}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full h-9 border-gray-200 text-sm">
                ย้อนกลับ
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="rounded-full h-9 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 text-sm"
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {importing ? 'กำลังนำเข้า...' : `นำเข้า ${jobs.length} รายการ`}
              </Button>
            </>
          )}

          {step === 3 && (
            <Button
              onClick={handleClose}
              className="ml-auto rounded-full h-9 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6 text-sm"
            >
              เสร็จสิ้น
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
