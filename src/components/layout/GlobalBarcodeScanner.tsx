'use client'

/**
 * GlobalBarcodeScanner
 * --------------------
 * รับ input จากสแกนเนอร์บาร์โค้ด (USB / Bluetooth) ทุกที่บนเว็บ
 * โดยไม่ต้องคลิก input ก่อน
 *
 * หลักการทำงาน:
 *   - สแกนเนอร์พิมพ์ตัวอักษรเร็วมาก (< 50ms ต่อตัว) แล้วจบด้วย Enter
 *   - ถ้า keydown ติดกันเร็ว ≥ 3 ตัว + Enter → ถือว่าเป็นการสแกน
 *   - parse ค่า  "JOB_ID|DWG_NAME"  แยก '|' เอา part[0] เป็น job id
 *   - navigate ไปที่ /dashboard/process-details/{jobId}
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanBarcode, X } from 'lucide-react'

const SCAN_TIMEOUT_MS = 250   // ถ้าพิมพ์ช้ากว่านี้ถือว่าเป็น manual typing (ปรับเพิ่มเป็น 250 ให้รองรับ scanner บางรุ่นที่พิมพ์ช้า)
const MIN_SCAN_LENGTH = 2    // ต้องได้อย่างน้อยกี่ตัวอักษร

export function GlobalBarcodeScanner() {
  const router = useRouter()
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [toast, setToast] = useState<{
    visible: boolean
    jobId: string
    dwgName: string
    status: 'navigating' | 'error'
  }>({ visible: false, jobId: '', dwgName: '', status: 'navigating' })

  const showToast = (jobId: string, dwgName: string, status: 'navigating' | 'error') => {
    setToast({ visible: true, jobId, dwgName, status })
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3500)
  }

  const handleScan = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed.length < MIN_SCAN_LENGTH) return

    // Create custom event so other components can intercept the scan
    const event = new CustomEvent('onBarcodeScan', {
      detail: { barcode: trimmed },
      cancelable: true,
    })
    document.dispatchEvent(event)

    // If a local component intercepted it (e.g. Process Action Scanner), do not navigate
    if (event.defaultPrevented) {
      return
    }

    const parts = trimmed.split('|')
    const jobId = parts[0]?.trim()
    const dwgName = parts[1]?.trim() ?? ''

    if (!jobId) return

    showToast(jobId, dwgName, 'navigating')
    router.push(`/dashboard/process-details/${encodeURIComponent(jobId)}`)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ถ้า focus อยู่ที่ input / textarea / select → ไม่สนใจ
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const now = Date.now()
      const elapsed = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // ถ้าพิมพ์ช้าเกิน threshold → reset buffer
      if (elapsed > SCAN_TIMEOUT_MS && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const captured = bufferRef.current
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        handleScan(captured)
        return
      }

      // สะสมตัวอักษรที่พิมพ์เร็ว
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Auto-clear ถ้าไม่มี Enter ภายใน 500ms
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 500)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (!toast.visible) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl shadow-black/10 border font-sans animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm w-full"
      style={{
        background: toast.status === 'navigating' ? '#1a1a2e' : '#fff0f0',
        borderColor: toast.status === 'navigating' ? '#2d2d4e' : '#fca5a5',
      }}
    >
      {/* Icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: toast.status === 'navigating' ? '#2d2d4e' : '#fee2e2' }}
      >
        <ScanBarcode
          className="h-4.5 w-4.5"
          style={{ color: toast.status === 'navigating' ? '#7c86ff' : '#dc2626' }}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold leading-tight"
          style={{ color: toast.status === 'navigating' ? '#e0e0ff' : '#dc2626' }}
        >
          {toast.status === 'navigating' ? '🔍 กำลังเปิดใบงาน...' : '❌ ไม่พบใบงาน'}
        </p>
        <p
          className="text-[11px] mt-0.5 font-semibold truncate"
          style={{ color: toast.status === 'navigating' ? '#a5b4fc' : '#ef4444' }}
        >
          JOB: {toast.jobId}
        </p>
        {toast.dwgName && (
          <p
            className="text-[11px] truncate"
            style={{ color: toast.status === 'navigating' ? '#6b7db3' : '#fca5a5' }}
          >
            DWG: {toast.dwgName}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
        className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
