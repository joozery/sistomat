'use client'

import { useRef, useState } from 'react'
import { ArchiveRestore, Download, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/lib/useCurrentUser'

function token() {
  return typeof window === 'undefined' ? '' : localStorage.getItem('token') ?? ''
}

export default function BackupPage() {
  const { role } = useCurrentUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function downloadBackup() {
    setBusy('backup')
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token()}` } })
      if (!response.ok) throw new Error('สร้าง Backup ไม่สำเร็จ')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sistomat-full-backup-${new Date().toISOString().slice(0, 10)}.json.gz`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('สร้างและดาวน์โหลด Backup เรียบร้อยแล้ว')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้าง Backup ไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('การ Restore จะเขียนทับข้อมูลทั้งระบบ ยืนยันดำเนินการหรือไม่?')) return
    setBusy('restore')
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/octet-stream' },
        body: await file.arrayBuffer(),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Restore ไม่สำเร็จ')
      setMessage(`Restore สำเร็จ: ${result.restoredCollections} Collection, ${result.restoredDocuments} รายการ, ${result.restoredFiles} ไฟล์`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore ไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  if (role.trim().toUpperCase() !== 'IT') return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 font-sans">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">System Recovery</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Backup ทั้งระบบ</h1>
        <p className="mt-2 text-sm text-gray-500">สำรองและกู้คืนข้อมูลฐานข้อมูล พร้อมไฟล์ PDF/3D/รูปภาพที่อยู่ในระบบ</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Restore จะเขียนทับข้อมูลทั้งระบบ ควรสร้างและดาวน์โหลด Backup ปัจจุบันเก็บไว้ก่อนทุกครั้ง</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <Download className="h-6 w-6 text-blue-600" />
          <h2 className="mt-3 font-bold text-gray-800">สร้าง Backup</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">รวมข้อมูลทุก Collection และไฟล์ที่อัปโหลดเป็นไฟล์ Backup เดียว</p>
          <Button onClick={downloadBackup} disabled={busy !== null} className="mt-5 w-full gap-2 rounded-full bg-[#7B1A1A] text-white hover:bg-[#5C1212]">
            {busy === 'backup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ดาวน์โหลด Backup
          </Button>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <ArchiveRestore className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-3 font-bold text-gray-800">Restore ข้อมูล</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">เลือกไฟล์ Backup ของระบบเพื่อกู้คืนข้อมูลเมื่อเกิดเหตุฉุกเฉิน</p>
          <input ref={fileRef} type="file" accept=".gz,.json" onChange={restoreBackup} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={busy !== null} variant="outline" className="mt-5 w-full gap-2 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            {busy === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            นำไฟล์ Backup กลับคืน
          </Button>
        </section>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  )
}
