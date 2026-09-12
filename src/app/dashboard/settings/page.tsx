'use client'

import { useState, useRef } from 'react'
import {
  Settings,
  CheckCircle2,
  Save,
  ListChecks,
  Plus,
  X,
  Loader2,
  Pencil,
  Trash2,
  Signature,
  Upload,
  Timer,
  Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useProcessOptions } from '@/lib/useProcessOptions'
import { useInspectors, type Inspector } from '@/lib/useInspectors'
import { useOvertimeThreshold } from '@/lib/useOvertimeThreshold'
import { useMachineRates, type MachineRate } from '@/lib/useMachineRates'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

/* ── Generic editable chip-list settings (process options, machine options, ...) ── */
function OptionsListSection({
  endpoint,
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  chipBg,
  chipText,
  chipBorder,
  placeholder,
  saveLabel,
  useOptions,
}: {
  endpoint: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  chipBg: string
  chipText: string
  chipBorder: string
  placeholder: string
  saveLabel: string
  useOptions: () => { options: string[]; loading: boolean; refresh: () => void }
}) {
  const { options, loading, refresh } = useOptions()
  const [draft, setDraft] = useState<string[]>([])
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [syncedFrom, setSyncedFrom] = useState<string[] | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // sync draft with fetched options once loaded (or when they change externally)
  if (!loading && syncedFrom !== options && JSON.stringify(syncedFrom) !== JSON.stringify(options)) {
    setDraft(options)
    setSyncedFrom(options)
  }

  function addOption() {
    const v = newOption.trim()
    if (!v || draft.includes(v)) return
    setDraft((prev) => [...prev, v])
    setNewOption('')
    setSaved(false)
  }

  function removeOption(opt: string) {
    setDraft((prev) => prev.filter((o) => o !== opt))
    setSaved(false)
  }

  function startEdit(index: number) {
    setEditingIndex(index)
    setEditValue(draft[index])
  }

  function cancelEdit() {
    setEditingIndex(null)
    setEditValue('')
  }

  function commitEdit() {
    if (editingIndex === null) return
    const v = editValue.trim()
    if (!v || draft.some((o, i) => o === v && i !== editingIndex)) {
      cancelEdit()
      return
    }
    setDraft((prev) => prev.map((o, i) => (i === editingIndex ? v : o)))
    setSaved(false)
    cancelEdit()
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ options: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'บันทึกไม่สำเร็จ')
        return
      }
      setSaved(true)
      refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>
        {saved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกแล้ว
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {draft.map((opt, index) =>
              editingIndex === index ? (
                <input
                  key={index}
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                  }}
                  className={`h-7 w-32 rounded-full border ${chipBorder} bg-white px-3 text-xs font-semibold ${chipText} outline-none focus:ring-2 focus:ring-indigo-200`}
                />
              ) : (
                <span
                  key={opt}
                  className={`inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold ${chipBg} ${chipText} border ${chipBorder}`}
                >
                  <button
                    onClick={() => startEdit(index)}
                    className="hover:underline decoration-dotted underline-offset-2"
                    title="แก้ไข"
                  >
                    {opt}
                  </button>
                  <button
                    onClick={() => startEdit(index)}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                    title="แก้ไข"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => removeOption(opt)}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                    title="ลบ"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            )}
            {draft.length === 0 && (
              <p className="text-xs text-gray-400">ยังไม่มีตัวเลือก — เพิ่มอย่างน้อย 1 รายการ</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
              placeholder={placeholder}
              className="rounded-xl h-10 text-sm border-gray-200"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addOption}
              className="gap-1.5 rounded-xl h-10 px-4 text-xs font-semibold shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่ม
            </Button>
          </div>

          {error && <p className="text-xs text-red-600 font-medium mt-3">{error}</p>}

          <div className="flex justify-end mt-5">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 text-xs font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Overtime threshold (grace period before a running process is marked OVERTIME) ── */
function OvertimeThresholdSection() {
  const { graceMinutes, loading, refresh } = useOvertimeThreshold()
  const [draft, setDraft] = useState(0)
  const [syncedFrom, setSyncedFrom] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!loading && syncedFrom !== graceMinutes) {
    setDraft(graceMinutes)
    setSyncedFrom(graceMinutes)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/overtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ graceMinutes: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'บันทึกไม่สำเร็จ')
        return
      }
      setSaved(true)
      refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-amber-50 border-amber-100">
            <Timer className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">เกณฑ์ OVERTIME (ค่าเริ่มต้น)</h3>
            <p className="text-xs text-gray-400">
              ค่าเริ่มต้นของทั้งระบบ — ใช้เมื่อกระบวนการนั้นไม่ได้ตั้งค่า OVERTIME ของตัวเองไว้ (ตั้งเฉพาะกระบวนการได้ที่หน้ารายละเอียดใบงาน ช่อง &quot;OVERTIME (นาที)&quot; ถัดจากเป้าหมาย)
            </p>
          </div>
        </div>
        {saved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกแล้ว
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => { setDraft(Math.max(0, Number(e.target.value) || 0)); setSaved(false) }}
              className="rounded-xl h-10 text-sm border-gray-200 w-32"
            />
            <span className="text-xs text-gray-500">นาที หลังเลยเป้าหมาย (0 = ขึ้น OVERTIME ทันทีที่ถึงเป้าหมาย)</span>
          </div>

          {error && <p className="text-xs text-red-600 font-medium mt-3">{error}</p>}

          <div className="flex justify-end mt-5">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 text-xs font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกเกณฑ์ OVERTIME
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Machine hour rates (ค่า ชม.เครื่อง) — default rates used by the quotation page ── */
function MachineRatesSection() {
  const { rates, loading, refresh } = useMachineRates()
  const { options: processOptions } = useProcessOptions()
  const [draft, setDraft] = useState<MachineRate[]>([])
  const [syncedFrom, setSyncedFrom] = useState<MachineRate[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!loading && syncedFrom !== rates && JSON.stringify(syncedFrom) !== JSON.stringify(rates)) {
    setDraft(rates)
    setSyncedFrom(rates)
  }

  function updateRow(index: number, patch: Partial<MachineRate>) {
    setDraft((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setSaved(false)
  }

  function removeRow(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addRow() {
    setDraft((prev) => [...prev, { process: '', rate: 0 }])
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/machine-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ rates: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'บันทึกไม่สำเร็จ')
        return
      }
      setSaved(true)
      refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-cyan-50 border-cyan-100">
            <Gauge className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">ค่า ชม.เครื่อง (บาท/ชม.)</h3>
            <p className="text-xs text-gray-400">
              อัตราเริ่มต้นต่อกระบวนการ — หน้าใบเสนอราคาจะดึงค่านี้มาใช้อัตโนมัติถ้าใบเสนอราคานั้นยังไม่เคยแก้ค่าเอง
            </p>
          </div>
        </div>
        {saved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกแล้ว
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {draft.map((r, index) => {
              const rowOptions = r.process && !processOptions.includes(r.process)
                ? [r.process, ...processOptions]
                : processOptions
              return (
              <div key={index} className="flex items-center gap-2">
                <Select value={r.process} onValueChange={(v) => updateRow(index, { process: v })}>
                  <SelectTrigger className="rounded-xl h-10 text-sm border-gray-200 flex-1">
                    <SelectValue placeholder="เลือกกระบวนการ / เครื่องจักร" />
                  </SelectTrigger>
                  <SelectContent>
                    {rowOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={r.rate}
                  onChange={(e) => updateRow(index, { rate: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="rounded-xl h-10 text-sm border-gray-200 w-28"
                />
                <span className="text-xs text-gray-400 shrink-0">บาท/ชม.</span>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              )
            })}
            {draft.length === 0 && (
              <p className="text-xs text-gray-400 py-2">ยังไม่มีอัตรากระบวนการ — กด &quot;เพิ่มแถว&quot; เพื่อเริ่มต้น</p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            className="gap-1.5 rounded-xl h-9 px-4 text-xs font-semibold mt-3"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มแถว
          </Button>

          {error && <p className="text-xs text-red-600 font-medium mt-3">{error}</p>}

          <div className="flex justify-end mt-5">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 text-xs font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกอัตราค่าเครื่อง
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Inspectors & Signatures Manager ── */
const emptyInspectorForm = { name: '', signature_url: '' }

function InspectorsSection() {
  const { inspectors, loading, refresh } = useInspectors()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Inspector | null>(null)
  const [form, setForm] = useState(emptyInspectorForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleting, setDeleting] = useState<Inspector | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function openAddForm() {
    setEditing(null)
    setForm(emptyInspectorForm)
    setFormError('')
    setIsFormOpen(true)
  }

  function openEditForm(insp: Inspector) {
    setEditing(insp)
    setForm({ name: insp.name, signature_url: insp.signature_url ?? '' })
    setFormError('')
    setIsFormOpen(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setFormError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload/signature', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body,
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message || 'อัปโหลดไม่สำเร็จ')
        return
      }
      setForm((f) => ({ ...f, signature_url: data.publicUrl }))
    } catch {
      setFormError('เกิดข้อผิดพลาดในการอัปโหลด')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setFormError('กรุณากรอกชื่อผู้ตรวจ')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/settings/inspectors', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(
          editing
            ? { id: editing.id, name: form.name.trim(), signature_url: form.signature_url || null }
            : { name: form.name.trim(), signature_url: form.signature_url || null }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'บันทึกไม่สำเร็จ')
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
    if (!deleting) return
    setIsDeleting(true)
    try {
      await fetch(`/api/settings/inspectors?id=${deleting.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setDeleting(null)
      refresh()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-rose-50 border-rose-100">
            <Signature className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">ผู้ตรวจสอบ &amp; ลายเซ็น</h3>
            <p className="text-xs text-gray-400">ใช้เลือกชื่อผู้ตรวจ/ผู้อนุมัติพร้อมลายเซ็นในใบ QC</p>
          </div>
        </div>
        <Button
          onClick={openAddForm}
          size="sm"
          className="gap-1.5 rounded-full h-8 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-3.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มผู้ตรวจ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : inspectors.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">ยังไม่มีผู้ตรวจ — กด &ldquo;เพิ่มผู้ตรวจ&rdquo; เพื่อเริ่มต้น</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {inspectors.map((insp) => (
            <div
              key={insp.id}
              className="relative flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 pt-3 pb-2.5"
            >
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                <button
                  onClick={() => openEditForm(insp)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                  title="แก้ไข"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setDeleting(insp)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-white transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <div className="flex h-14 w-full items-center justify-center rounded-lg bg-white border border-gray-100 overflow-hidden">
                {insp.signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={insp.signature_url} alt={insp.name} className="max-h-14 max-w-full object-contain" />
                ) : (
                  <Signature className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <p className="text-xs font-semibold text-gray-700 text-center line-clamp-1">{insp.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขผู้ตรวจ' : 'เพิ่มผู้ตรวจ'}</DialogTitle>
            <DialogDescription>ชื่อและลายเซ็นจะใช้เลือกในหน้าใบ QC ของทุกใบงาน</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="insp-name" className="text-xs font-semibold text-gray-700">ชื่อผู้ตรวจ</Label>
              <Input
                id="insp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">ลายเซ็น (รูปภาพ)</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
                  {form.signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.signature_url} alt="ลายเซ็น" className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <Signature className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                  id="insp-signature-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 rounded-xl h-9 text-xs font-semibold"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {form.signature_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                </Button>
              </div>
            </div>

            {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || uploading}
              className="rounded-xl bg-[#7B1A1A] hover:bg-[#5C1212] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'บันทึก' : 'เพิ่มผู้ตรวจ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm Dialog */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบผู้ตรวจ</DialogTitle>
            <DialogDescription>
              ต้องการลบ <span className="font-semibold text-gray-700">{deleting?.name}</span> ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 font-sans">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">System</p>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          ตั้งค่าระบบ
          <Settings className="h-5 w-5 text-[#7B1A1A]" />
        </h1>
      </div>

      <OptionsListSection
        endpoint="/api/settings/process-options"
        title="ตัวเลือกกระบวนการ / เครื่องจักร"
        description="ใช้ทั้งใน dropdown “กระบวนการ” ของหน้าใบงาน และสิทธิ์เครื่องจักรตอนเพิ่ม/แก้ไขพนักงาน (รายการเดียวกัน)"
        icon={ListChecks}
        iconBg="bg-indigo-50 border-indigo-100"
        iconColor="text-indigo-600"
        chipBg="bg-indigo-50"
        chipText="text-indigo-700"
        chipBorder="border-indigo-100"
        placeholder="เพิ่มกระบวนการ/เครื่องจักรใหม่ เช่น CNC 6"
        saveLabel="บันทึกตัวเลือก"
        useOptions={useProcessOptions}
      />

      <OvertimeThresholdSection />

      <MachineRatesSection />

      <InspectorsSection />

    </div>
  )
}
