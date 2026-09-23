'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function HoldReasonDialog({ processName, onCancel, onConfirm }: {
  processName: string
  onCancel: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ระบุเหตุผลในการ HOLD</DialogTitle>
          <DialogDescription>พักกระบวนการ {processName} และหยุดเวลาพนักงานเมื่อยืนยัน</DialogDescription>
        </DialogHeader>
        <form onSubmit={async event => {
          event.preventDefault()
          if (!reason.trim() || saving) return
          setSaving(true)
          setError('')
          try { await onConfirm(reason.trim()) }
          catch (error) { setError(error instanceof Error ? error.message : 'บันทึก HOLD ไม่สำเร็จ') }
          finally { setSaving(false) }
        }} className="space-y-4">
          <label htmlFor="hold-reason" className="block text-sm font-medium">เหตุผลในการ HOLD <span className="text-red-600">*</span></label>
          <textarea id="hold-reason" autoFocus required maxLength={500} disabled={saving}
            value={reason} onChange={event => setReason(event.target.value)}
            placeholder="เช่น รอวัตถุดิบ / แบบงานต้องแก้ไข / เครื่องขัดข้อง"
            className="w-full min-h-24 rounded-lg border border-gray-300 p-3 text-sm" />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>ยกเลิก</Button>
            <Button type="submit" disabled={saving || !reason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? 'กำลังบันทึก...' : 'ยืนยัน HOLD'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
