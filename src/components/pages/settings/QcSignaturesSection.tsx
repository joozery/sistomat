'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Signature, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Slot = 'qc_signature_url' | 'approve_signature_url'
type Signatures = Record<Slot, string>

const empty: Signatures = { qc_signature_url: '', approve_signature_url: '' }

export function QcSignaturesSection() {
  const [signatures, setSignatures] = useState<Signatures>(empty)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const qcFileRef = useRef<HTMLInputElement>(null)
  const approveFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings/qc-signatures', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'โหลดลายเซ็นไม่สำเร็จ')
        setSignatures(data)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดลายเซ็นไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  async function upload(slot: Slot, file: File) {
    setError('')
    setSaved(false)
    setUploading(slot)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/signature', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'อัปโหลดไม่สำเร็จ')
      setSignatures((prev) => ({ ...prev, [slot]: data.publicUrl }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings/qc-signatures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(signatures),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ')
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const slots: { key: Slot; label: string; ref: typeof qcFileRef }[] = [
    { key: 'qc_signature_url', label: 'QC', ref: qcFileRef },
    { key: 'approve_signature_url', label: 'Approve', ref: approveFileRef },
  ]

  return (
    <section className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <Signature className="h-5 w-5 text-rose-600" />
        <div>
          <h3 className="text-sm font-bold text-gray-800">ลายเซ็นประจำช่องในใบ QC</h3>
          <p className="text-xs text-gray-500">ตั้งค่า QC และ Approve แยกกัน ใช้กับใบ QC ทุกใบ</p>
        </div>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {slots.map(({ key, label, ref }) => (
              <div key={key} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-700">ช่อง {label}</p>
                <div className="h-24 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                  {signatures[key]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={signatures[key]} alt={`ลายเซ็น ${label}`} className="max-w-full max-h-full object-contain" />
                    : <span className="text-xs text-gray-400">ยังไม่ได้กำหนด</span>}
                </div>
                <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload(key, file)
                    event.target.value = ''
                  }} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={Boolean(uploading) || saving}
                    onClick={() => ref.current?.click()} className="gap-1">
                    {uploading === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {signatures[key] ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                  </Button>
                  {signatures[key] && <Button type="button" variant="ghost" size="sm" disabled={Boolean(uploading) || saving}
                    onClick={() => { setSignatures((prev) => ({ ...prev, [key]: '' })); setSaved(false) }}>ล้าง</Button>}
                </div>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
          {saved && <p className="mt-3 text-xs text-emerald-700">บันทึกแล้ว ทุกใบ QC จะใช้ลายเซ็นตามนี้</p>}
          <Button type="button" onClick={save} disabled={saving || Boolean(uploading)} className="mt-4 gap-1.5 bg-[#7B1A1A] hover:bg-[#5C1212]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกลายเซ็น
          </Button>
        </>
      )}
    </section>
  )
}
