'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  Users,
  QrCode,
  Bell,
  BarChart2,
  ClipboardList,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Radio,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MenuItem {
  label: string
  path: string
  icon: React.ElementType
  badge?: string | number
}

const mainMenuItems: MenuItem[] = [
  { label: 'แดชบอร์ด', path: '/dashboard', icon: LayoutDashboard },
  { label: 'การจัดการผู้ใช้งาน', path: '/dashboard/user-management', icon: Users },
  { label: 'จัดการ QR Code', path: '/dashboard/process-qrcode', icon: QrCode },
]

const managementMenuItems: MenuItem[] = [
  { label: 'ติดตาม Real-time', path: '/dashboard/realtime', icon: Radio },
  { label: 'การแจ้งเตือน', path: '/dashboard/notifications', icon: Bell, badge: '3' },
  { label: 'สรุปรายการทั้งหมด', path: '/dashboard/monthly-summary', icon: BarChart2 },
  { label: 'แพลนงานทั้งหมด', path: '/dashboard/all-plans', icon: ClipboardList },
]

export function AppSidebar() {
  const pathname = usePathname()

  const renderMenuSection = (items: MenuItem[]) => (
    <SidebarMenu className="gap-1.5">
      {items.map((item) => {
        const isActive =
          item.path === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.path)

        return (
          <SidebarMenuItem key={item.path} className="flex justify-center">
            <Link
              href={item.path}
              title={item.label}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 w-full group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl ${
                isActive
                  ? 'bg-gradient-to-r from-red-50 via-red-50/80 to-transparent text-[#c62828] font-semibold border border-red-100/60 group-data-[collapsible=icon]:bg-[#c62828] group-data-[collapsible=icon]:text-white group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:shadow-md group-data-[collapsible=icon]:shadow-red-500/20'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 group-data-[collapsible=icon]:hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors shrink-0 group-data-[collapsible=icon]:h-full group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-current ${
                    isActive
                      ? 'bg-[#c62828] text-white shadow-md shadow-red-500/20'
                      : 'bg-gray-100/80 text-gray-500 group-hover:bg-white group-hover:text-gray-700 group-hover:shadow-sm'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-xs lg:text-sm tracking-tight group-data-[collapsible=icon]:hidden whitespace-nowrap">
                  {item.label}
                </span>
              </div>

              {item.badge ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full group-data-[collapsible=icon]:hidden ${
                    isActive
                      ? 'bg-[#c62828] text-white'
                      : 'bg-red-100 text-[#c62828]'
                  }`}
                >
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="h-4 w-4 text-[#c62828] opacity-70 group-data-[collapsible=icon]:hidden" />
              ) : null}
            </Link>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-100/80 bg-white font-sans">
      {/* Header */}
      <SidebarHeader className="px-4 py-5 border-b border-gray-100/60 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-4">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <Image
              src="/logo.png"
              alt="Sistomat"
              width={130}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Compact Logo Mark for Icon Mode */}
          <Link href="/dashboard" className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#c62828] to-[#ef5350] text-white font-bold text-base shadow-sm shadow-red-500/20">
              S
            </div>
          </Link>
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="px-3 py-4 flex-1 space-y-6 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:space-y-4">
        {/* Main Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 group-data-[collapsible=icon]:hidden">
            เมนูหลัก
          </p>
          {renderMenuSection(mainMenuItems)}
        </div>

        {/* Management & Reports Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 group-data-[collapsible=icon]:hidden">
            การจัดการ & รายงาน
          </p>
          {renderMenuSection(managementMenuItems)}
        </div>

        {/* System Status / Feature Highlight Card */}
        <div className="pt-2 group-data-[collapsible=icon]:hidden">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 via-white to-red-50/40 p-4 border border-red-100/80 shadow-sm">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-red-500/10 rounded-full blur-lg" />
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#c62828] to-[#ef5350] text-white shadow-md shadow-red-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  SISTOMAT ERP <Sparkles className="h-3 w-3 text-amber-500" />
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  ระบบบริหารจัดการคลังสินค้าและกระบวนการผลิตเต็มรูปแบบ
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-gray-100/60 px-4 py-4 bg-gray-50/50 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
            <div className="relative flex justify-center items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 text-white text-xs font-bold shadow-sm">
                N
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-bold text-gray-800 leading-tight">Admin User</p>
              <p className="text-[10px] text-gray-400 font-medium">v2.4 Sistomat Ltd.</p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
