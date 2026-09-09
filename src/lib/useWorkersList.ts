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
      })
      if (res.ok) setWorkers(await res.json())
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { workers, loading, refresh }
}
