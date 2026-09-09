'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Inspector {
  id: string
  name: string
  signature_url: string | null
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useInspectors() {
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/inspectors', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setInspectors(await res.json())
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { inspectors, loading, refresh }
}
