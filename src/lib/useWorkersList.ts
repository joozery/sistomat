'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WorkerData } from './workers'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useWorkersList() {
  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/workers', {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      })
      if (res.ok) setWorkers(await res.json())
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = setTimeout(() => { void refresh() }, 0)

    // สิทธิ์เครื่องจักรอาจถูก Admin เปลี่ยนขณะที่หน้าใบงานเปิดค้างอยู่
    // จึงต้องดึงรายการใหม่เป็นระยะ และทันทีเมื่อผู้ใช้กลับมาที่หน้าต่างนี้
    const interval = setInterval(() => { void refresh() }, 5_000)
    const handleFocus = () => { void refresh() }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(initialRefresh)
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refresh])

  return { workers, loading, refresh }
}
