'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Printer, ShieldOff, ShieldCheck, Loader2 } from 'lucide-react'
import { WORKERS_LIST } from '@/lib/workers'

const Barcoder = dynamic(() => import('react-barcode'), { ssr: false })

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function WorkerBarcodes() {
  const [blockedCodes, setBlockedCodes] = useState<Set<number>>(new Set())
  const [toggling, setToggling] = useState<number | null>(null)

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await fetch('/api/workers/block', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) return
      const codes: number[] = await res.json()
      setBlockedCodes(new Set(codes))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchBlocked() }, [fetchBlocked])

  async function toggleBlock(code: number, name: string, currentlyBlocked: boolean) {
    setToggling(code)
    try {
      await fetch('/api/workers/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ code, name, block: !currentlyBlocked }),
      })
      setBlockedCodes((prev) => {
        const next = new Set(prev)
        if (currentlyBlocked) next.delete(code)
        else next.add(code)
        return next
      })
    } catch { /* ignore */ }
    finally { setToggling(null) }
  }

  const workers = WORKERS_LIST.filter((w) => w.code !== 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm/50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-800">บาร์โค้ดพนักงาน</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            สแกนเพื่อระบุตัวพนักงาน — กดบล็อกเพื่อระงับสิทธิ์สแกนชั่วคราว
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors print:hidden"
        >
          <Printer className="h-3.5 w-3.5" />
          ปริ้นทั้งหมด
        </button>
      </div>

      {/* Stats row */}
      {blockedCodes.size > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100 print:hidden">
          <ShieldOff className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs font-semibold text-red-700">
            บล็อกอยู่ {blockedCodes.size} คน — ไม่สามารถสแกนงานได้จนกว่าจะยกเลิกบล็อก
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 print:grid-cols-4 print:gap-2 print:p-2">
        {workers.map((worker) => {
          const isBlocked = blockedCodes.has(worker.code)
          const isToggling = toggling === worker.code
          return (
            <div
              key={worker.code}
              className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 pt-3 pb-2 transition-colors print:border print:border-gray-300 print:rounded-lg ${
                isBlocked
                  ? 'border-red-200 bg-red-50/60'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              {/* Blocked overlay text */}
              {isBlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-red-100/40 print:hidden">
                  <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200 tracking-widest">
                    BLOCKED
                  </span>
                </div>
              )}

              <div className={isBlocked ? 'opacity-30 pointer-events-none select-none' : ''}>
                <Barcoder
                  value={String(worker.code)}
                  format="CODE128"
                  width={1.8}
                  height={56}
                  fontSize={11}
                  margin={2}
                  background={isBlocked ? '#fef2f2' : '#f9fafb'}
                  lineColor="#111827"
                  displayValue={false}
                />
                <p className="text-[13px] font-bold text-gray-800 tabular-nums text-center">{worker.code}</p>
                <p className="text-[10px] text-gray-500 text-center leading-tight line-clamp-2">{worker.name}</p>
                <p className="text-[9px] text-gray-400 text-center leading-tight">{worker.machines.join(', ')}</p>
              </div>

              {/* Block/Unblock button */}
              <button
                onClick={() => toggleBlock(worker.code, worker.name, isBlocked)}
                disabled={isToggling}
                className={`mt-1 relative z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all print:hidden ${
                  isBlocked
                    ? 'bg-white border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                }`}
              >
                {isToggling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isBlocked ? (
                  <><ShieldCheck className="h-3 w-3" /> ยกเลิกบล็อก</>
                ) : (
                  <><ShieldOff className="h-3 w-3" /> บล็อก</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
