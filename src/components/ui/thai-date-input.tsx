'use client'

import { useRef, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { Calendar } from 'lucide-react'

type ThaiDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function formatThaiDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  return `${match[3]}/${match[2]}/${Number(match[1]) + 543}`
}

export function ThaiDateInput({ value, onChange, className, placeholder, ...props }: ThaiDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    try {
      input.showPicker?.()
    } catch {
      input.click()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  return (
    <div className="relative cursor-pointer" role="button" tabIndex={0} onClick={openPicker} onKeyDown={handleKeyDown}>
      <Calendar className="pointer-events-none absolute left-3 top-1/2 z-20 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <div className={`${className ?? ''} pointer-events-none flex items-center pl-9`}>
        {value ? formatThaiDate(value) : (placeholder ?? 'วว/ดด/ปปปป')}
      </div>
      <input
        {...props}
        ref={inputRef}
        type="date"
        value={value}
        onChange={onChange}
        aria-label={placeholder ?? 'เลือกวันที่'}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  )
}
