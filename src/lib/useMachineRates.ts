'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MachineRate {
  process: string
  rate: number
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useMachineRates() {
  const [rates, setRates] = useState<MachineRate[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/machine-rates', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRates(data.rates ?? [])
      }
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { rates, loading, refresh }
}
