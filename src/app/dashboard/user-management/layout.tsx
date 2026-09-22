'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Cpu, ShieldCheck, UserCheck, IdCard, UsersRound, HardHat, Crown } from 'lucide-react'

const tabs = [
  { label: 'จัดการผู้ใช้งาน', href: '/dashboard/user-management', icon: UsersRound },
  { label: 'บาร์โค้ดพนักงาน', href: '/dashboard/user-management/barcodes', icon: IdCard },
]

// เมตาการแสดงผลต่อ role — role ไหนไม่มีข้อมูลจริงจะไม่โชว์การ์ดเลย
const ROLE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; border: string }> = {
  superadmin: { label: 'ผู้ดูแลระบบสูงสุด', icon: Crown, color: 'text-amber-700 bg-amber-50', border: 'border-amber-200' },
  Admin: { label: 'ผู้ดูแลระบบ', icon: ShieldCheck, color: 'text-[#7B1A1A] bg-red-50', border: 'border-red-100' },
  'ช่าง': { label: 'ช่างเครื่องจักร', icon: HardHat, color: 'text-purple-700 bg-purple-50', border: 'border-purple-100' },
  User: { label: 'พนักงานทั่วไป', icon: Cpu, color: 'text-emerald-700 bg-emerald-50', border: 'border-emerald-100' },
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

export default function UserManagementLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [roleCounts, setRoleCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/users', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.users)) return
        const counts: Record<string, number> = { __total: data.users.length }
        for (const u of data.users as { role?: string }[]) {
          const role = u.role || 'User'
          counts[role] = (counts[role] ?? 0) + 1
        }
        setRoleCounts(counts)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ดึงเฉพาะข้อมูลจริง — role ไหนไม่มีคนเลยไม่โชว์การ์ด
  const stats = roleCounts
    ? [
        { label: 'พนักงานทั้งหมด', value: `${roleCounts.__total} คน`, icon: Users, color: 'text-gray-700 bg-gray-100', border: 'border-gray-200' },
        ...Object.entries(roleCounts)
          .filter(([role, count]) => role !== '__total' && count > 0)
          .map(([role, count]) => {
            const meta = ROLE_META[role]
            return {
              label: meta?.label ?? role,
              value: `${count} คน`,
              icon: meta?.icon ?? Users,
              color: meta?.color ?? 'text-gray-700 bg-gray-100',
              border: meta?.border ?? 'border-gray-200',
            }
          }),
      ]
    : []

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Stats Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
              Human Resources
            </span>
            <span className="text-xs text-gray-400">/ สิทธิ์การใช้งาน</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            จัดการผู้ใช้งาน
            <UserCheck className="h-5 w-5 text-[#7B1A1A]" />
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            บริหารจัดการรายชื่อพนักงาน กำหนดสิทธิ์การเข้าถึงเครื่องจักร และระดับผู้ดูแลระบบ
          </p>
        </div>

        {/* Stat cards */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 rounded-xl p-3 border ${s.border} bg-white transition-all`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                  <p className="text-sm font-bold text-gray-800">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-full w-fit print:hidden">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white text-[#7B1A1A] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
