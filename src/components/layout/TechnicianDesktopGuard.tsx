'use client'

import Image from 'next/image'
import { useSyncExternalStore } from 'react'
import { useCurrentUser } from '@/lib/useCurrentUser'

function subscribeToDeviceChange(callback: () => void) {
  window.addEventListener('resize', callback)
  window.addEventListener('orientationchange', callback)
  return () => {
    window.removeEventListener('resize', callback)
    window.removeEventListener('orientationchange', callback)
  }
}

function isPhoneOrTablet(): boolean {
  const ua = navigator.userAgent
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua)
  // iPadOS รุ่นใหม่รายงานตัวเองเหมือน macOS แต่มีจอสัมผัสหลายจุด
  const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isMobileUserAgent || isModernIPad
}

export function TechnicianDesktopGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentUser()
  const restrictedDevice = useSyncExternalStore(
    subscribeToDeviceChange,
    isPhoneOrTablet,
    () => false,
  )

  if (role === 'ช่าง' && restrictedDevice) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-white">
        <Image
          src="/logo.svg"
          alt="Sistomat"
          width={220}
          height={72}
          className="h-auto w-[180px] object-contain sm:w-[220px]"
          priority
        />
      </div>
    )
  }

  return children
}
