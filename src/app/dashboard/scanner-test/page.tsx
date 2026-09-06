'use client'

import { useRef, useState } from 'react'

export default function ScannerTestPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<string[]>([])
  const [raw, setRaw] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputRef.current?.value ?? ''
      setResults((prev) => [val, ...prev].slice(0, 10))
      setRaw(val)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 font-sans p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">🔍 ทดสอบเครื่องสแกน</h1>
        <p className="text-gray-500 mt-1 text-sm">คลิกที่กล่องด้านล่าง แล้วสแกนบาร์โค้ดได้เลย</p>
      </div>

      {/* Big click target */}
      <div
        className="w-full max-w-md cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          className="w-full text-2xl font-mono text-center border-4 border-blue-400 rounded-2xl p-6 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-blue-50 placeholder-blue-300"
          placeholder="คลิกที่นี่ แล้วสแกน"
          autoComplete="off"
          autoFocus
        />
      </div>

      {raw && (
        <div className="w-full max-w-md rounded-2xl bg-green-50 border-2 border-green-400 p-6 text-center">
          <p className="text-xs font-bold text-green-600 mb-1">สแกนได้ล่าสุด</p>
          <p className="text-3xl font-mono font-bold text-green-800 break-all">{raw}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="w-full max-w-md space-y-2">
          <p className="text-xs font-bold text-gray-500">ประวัติ</p>
          {results.map((r, i) => (
            <div key={i} className="font-mono text-sm bg-white border border-gray-200 rounded-xl px-4 py-2 text-gray-700">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
