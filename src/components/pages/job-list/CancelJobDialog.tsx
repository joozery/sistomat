'use client'

import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CancelJobDialog({
  jobCode,
  open,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  jobCode: string
  open: boolean
  saving: boolean
  error: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !saving) {
      setReason('')
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-0 bg-white p-6 font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Ban className="h-5 w-5 text-red-700" />
            ยืนยันยกเลิกใบงาน
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-gray-500">
            ยกเลิกเฉพาะ Job <span className="font-mono font-bold text-gray-700">{jobCode}</span> และหยุดการทำงานที่กำลังดำเนินอยู่
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="กรุณาระบุเหตุผลการยกเลิก"
          autoFocus
          rows={4}
          maxLength={500}
          disabled={saving}
          className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="h-9 rounded-full border-gray-200">
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={saving || !reason.trim()}
            className="h-9 rounded-full bg-red-700 px-5 text-white hover:bg-red-800"
          >
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {saving ? 'กำลังบันทึก...' : 'ยืนยันยกเลิกงาน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
