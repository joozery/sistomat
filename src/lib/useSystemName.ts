'use client'

import { useState, useEffect, useCallback } from 'react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useSystemName() {
  const [subName, setSubName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const token = getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/settings/system-name', { headers })
      if (res.ok) {
        const data = await res.json()
        setSubName(data.sub_name ?? '')
      }
    } catch {
      // keep existing state on network error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ sub_name?: string }>
      if (custom.detail && typeof custom.detail.sub_name === 'string') {
        setSubName(custom.detail.sub_name)
      } else {
        refresh()
      }
    }
    window.addEventListener('system-name-updated', handleUpdate)
    return () => window.removeEventListener('system-name-updated', handleUpdate)
  }, [refresh])

  return { subName, setSubName, loading, refresh }
}
