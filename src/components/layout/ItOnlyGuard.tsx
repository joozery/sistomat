'use client'

import { useCurrentUser } from '@/lib/useCurrentUser'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ItOnlyGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentUser()
  const pathname = usePathname()
  const router = useRouter()
  const isIT = role.trim().toUpperCase() === 'IT'

  useEffect(() => {
    if (isIT && !pathname.startsWith('/dashboard/backup')) router.replace('/dashboard/backup')
    if (!isIT && pathname.startsWith('/dashboard/backup')) router.replace('/dashboard')
  }, [isIT, pathname, router])

  if (isIT && !pathname.startsWith('/dashboard/backup')) return null
  if (!isIT && pathname.startsWith('/dashboard/backup')) return null
  return <>{children}</>
}
