'use client'

import { useState, useEffect, useCallback } from 'react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useOvertimeThreshold() {
  const [graceMinutes, setGraceMinutes] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/overtime', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setGraceMinutes(data.graceMinutes ?? 0)
      }
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { graceMinutes, loading, refresh }
}
