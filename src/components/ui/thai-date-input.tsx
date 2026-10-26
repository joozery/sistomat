'use client'

import { type ChangeEvent, type InputHTMLAttributes } from 'react'
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
  return (
    <label className="relative block cursor-pointer">
      <Calendar className="pointer-events-none absolute left-3 top-1/2 z-20 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <div className={`${className ?? ''} pointer-events-none flex items-center pl-9`}>
        {value ? formatThaiDate(value) : (placeholder ?? 'วว/ดด/ปปปป')}
      </div>
      <input
        {...props}
        type="date"
        value={value}
        onChange={onChange}
        aria-label={placeholder ?? 'เลือกวันที่'}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.()
          } catch {
            // Browsers without showPicker() open the native picker normally.
          }
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
    </label>
  )
}
