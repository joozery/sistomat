'use client'

import { useState, useEffect, useCallback } from 'react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useStopReasons() {
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/stop-reasons', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setOptions(data.options ?? [])
      }
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { options, loading, refresh }
}
