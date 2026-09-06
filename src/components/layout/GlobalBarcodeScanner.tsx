'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ScanBarcode, X } from 'lucide-react'

const SCAN_TIMEOUT_MS = 300
const MIN_SCAN_LENGTH = 2

function codeToChar(code: string, shift: boolean): string | null {
  if (code.startsWith('Digit')) {
    const d = code.slice(5)
    return shift ? '!@#$%^&*()'[parseInt(d)] ?? null : d
  }
  if (code.startsWith('Key')) {
    const c = code.slice(3)
    return shift ? c : c.toLowerCase()
  }
  const symbols: Record<string, [string, string]> = {
    Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'],
    BracketRight: [']', '}'], Backslash: ['\\', '|'], Semicolon: [';', ':'],
    Quote: ["'", '"'], Backquote: ['`', '~'], Comma: [',', '<'],
    Period: ['.', '>'], Slash: ['/', '?'], Space: [' ', ' '],
  }
  const pair = symbols[code]
  return pair ? pair[shift ? 1 : 0] : null
}

export function GlobalBarcodeScanner() {
  const router = useRouter()
  const pathname = usePathname()
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [lastScan, setLastScan] = useState<string>('')
  const [navToast, setNavToast] = useState<{
    visible: boolean; jobId: string; dwgName: string
  }>({ visible: false, jobId: '', dwgName: '' })

  const handleScan = useCallback((raw: string) => {
    const trimmed = raw.trim()
    if (trimmed.length < MIN_SCAN_LENGTH) return

    setLastScan(trimmed)

    const event = new CustomEvent('onBarcodeScan', { detail: { barcode: trimmed }, cancelable: true })
    document.dispatchEvent(event)
    if (event.defaultPrevented) return

    const parts = trimmed.split('|')
    const jobId = parts[0]?.trim().toUpperCase()
    const dwgName = parts[1]?.trim() ?? ''
    if (!jobId) return

    setNavToast({ visible: true, jobId, dwgName })
    setTimeout(() => setNavToast((p) => ({ ...p, visible: false })), 3000)
    router.push(`/dashboard/process-details/${encodeURIComponent(jobId)}`)
  }, [router])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ถ้า focus อยู่ที่ real input → ไม่จับ (ให้ user พิมพ์ตามปกติ)
      const tag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const now = Date.now()
      const elapsed = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // reset buffer ถ้าช้าเกินไป (คนพิมพ์ ไม่ใช่ scanner)
      if (elapsed > SCAN_TIMEOUT_MS) bufferRef.current = ''

      if (e.key === 'Enter' || e.code === 'Enter') {
        const captured = bufferRef.current
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        if (captured.length >= MIN_SCAN_LENGTH) {
          e.preventDefault()
          handleScan(captured)
        }
        return
      }

      const char = codeToChar(e.code, e.shiftKey)
      if (!char) return

      // กัน default เสมอเมื่อมีการพิมพ์นอก input (ป้องกัน scroll, shortcut)
      e.preventDefault()

      bufferRef.current += char
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { bufferRef.current = '' }, 600)
    }

    // capture:true → ทำงานก่อน element ทุกตัว, stopPropagation จาก element อื่นไม่กระทบ
    document.addEventListener('keydown', onKeyDown, { capture: true })
    setIsActive(true)

    const onWindowBlur = () => setIsActive(false)
    const onWindowFocus = () => setIsActive(true)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('focus', onWindowFocus)

    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('focus', onWindowFocus)
    }
  }, [handleScan])

  // reset lastScan label on navigation
  useEffect(() => { setLastScan('') }, [pathname])

  return (
    <>
      {/* Scan indicator bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 py-1.5 select-none transition-colors"
        style={{ background: isActive ? '#052e16' : '#1c1917' }}
      >
        <div className={`h-2 w-2 rounded-full transition-colors ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
        <span className={`text-[11px] font-semibold transition-colors ${isActive ? 'text-emerald-300' : 'text-zinc-400'}`}>
          {isActive
            ? lastScan
              ? `📷 สแกนล่าสุด: ${lastScan.length > 30 ? lastScan.slice(0, 30) + '…' : lastScan}`
              : '📷 พร้อมสแกน — สแกนบาร์โค้ดได้เลย'
            : '📷 คลิกที่หน้าต่างนี้เพื่อเปิดใช้สแกนเนอร์'}
        </span>
      </div>

      {/* Navigation toast */}
      {navToast.visible && (
        <div
          className="fixed bottom-12 right-6 z-50 flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border font-sans max-w-sm"
          style={{ background: '#1a1a2e', borderColor: '#2d2d4e' }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-900">
            <ScanBarcode className="h-5 w-5 text-indigo-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-indigo-100">🔍 กำลังเปิดใบงาน...</p>
            <p className="text-[11px] font-semibold text-indigo-300 truncate mt-0.5">JOB: {navToast.jobId}</p>
            {navToast.dwgName && (
              <p className="text-[11px] text-indigo-500 truncate">{navToast.dwgName}</p>
            )}
          </div>
          <button
            onClick={() => setNavToast((p) => ({ ...p, visible: false }))}
            className="text-zinc-500 hover:text-white mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
