'use client'

import { useState, useEffect, useCallback } from 'react'

export interface QuotationHeader {
  company_name: string
  address: string
  phone: string
  email: string
  logo_url: string
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export function useQuotationHeader() {
  const [header, setHeader] = useState<QuotationHeader | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/quotation-header', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setHeader(await res.json())
    } catch {
      // keep previous state on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { header, loading, refresh }
}
