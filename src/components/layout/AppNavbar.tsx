'use client'

import { useSyncExternalStore, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  LogOut,
  ChevronDown,
  Calendar,
  Bell,
  Search,
  User as UserIcon,
  Settings,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Check,
  ArrowRight,
} from 'lucide-react'

interface UserInfo {
  username: string
  role: string
}

const DEFAULT_USER: UserInfo = { username: 'admin', role: 'Administrator' }

let _cachedRaw = ''
let _cachedUser: UserInfo = DEFAULT_USER

function readUserFromStorage(): UserInfo {
  try {
    const raw = localStorage.getItem('user') ?? '{}'
    if (raw === _cachedRaw) return _cachedUser
    _cachedRaw = raw
    const parsed = JSON.parse(raw)
    _cachedUser = {
      username: parsed.username || 'admin',
      role: parsed.role || 'Administrator',
    }
    return _cachedUser
  } catch {
    return DEFAULT_USER
  }
}

function subscribeToStorage(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

interface PopupNotification {
  id: number
  title: string
  desc: string
  time: string
  read: boolean
  type: 'success' | 'warning' | 'error' | 'info'
}

const initialPopupNotifications: PopupNotification[] = [
  {
    id: 1,
    title: 'เครื่อง CNC 2 แจ้งเตือนน้ำมันหล่อเย็น',
    desc: 'ระดับน้ำมันต่ำกว่า 20% กรุณาเติมก่อนผลิตถัดไป',
    time: '10 นาทีที่แล้ว',
    read: false,
    type: 'warning',
  },
  {
    id: 2,
    title: 'สแกน QR Code ใบงาน #JOB-8842 เสร็จสิ้น',
    desc: 'ขั้นตอน LATHE 1 ผ่านการตรวจสอบ 100%',
    time: '35 นาทีที่แล้ว',
    read: false,
    type: 'success',
  },
  {
    id: 3,
    title: 'พบชิ้นงานไม่ผ่านเกณฑ์ QC (#JOB-8845)',
    desc: 'พบรอยขีดข่วนเกินค่าความคลาดเคลื่อน',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
    type: 'error',
  },
  {
    id: 4,
    title: 'ฝ่าย MAT เบิกจ่ายเหล็กเพลาสำเร็จ',
    desc: 'เตรียมพร้อมสำหรับแพลนงานสัปดาห์นี้',
    time: '3 ชั่วโมงที่แล้ว',
    read: true,
    type: 'info',
  },
]

export function AppNavbar() {
  const router = useRouter()
  const user = useSyncExternalStore(
    subscribeToStorage,
    readUserFromStorage,
    () => DEFAULT_USER
  )

  const [notifications, setNotifications] = useState<PopupNotification[]>(initialPopupNotifications)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth')
    localStorage.removeItem('user')
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/login')
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const markSingleRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 lg:px-6 font-sans">
      {/* Left: Sidebar Trigger & Greeting */}
      <div className="flex items-center gap-3 lg:gap-4">
        <SidebarTrigger className="h-9 w-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors" />

        <div className="h-4 w-[1px] bg-gray-200 hidden sm:block" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500 font-normal">ยินดีต้อนรับ,</span>
            <span className="text-sm font-bold text-gray-800 tracking-tight capitalize">
              {user.username}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/50 text-xs font-medium text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-[#7B1A1A]" />
            <span>{today}</span>
          </div>
        </div>
      </div>

      {/* Middle: Search Input */}
      <div className="hidden lg:flex items-center relative w-64 xl:w-80">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาเมนู ข้อมูล หรือรายงาน..."
          className="w-full pl-10 pr-4 py-1.5 bg-gray-50 border border-gray-200/80 rounded-full text-xs text-gray-700 placeholder-gray-400 focus:bg-white focus:border-[#7B1A1A] focus:ring-1 focus:ring-[#7B1A1A] transition-all outline-none"
        />
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Facebook-style Notification Popup Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors outline-none">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7B1A1A] text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[320px] sm:w-[340px] p-0 rounded-xl border border-gray-200 bg-white font-sans">
            {/* Header Popup */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-800">การแจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-[#7B1A1A] bg-red-50 px-1.5 py-0.2 rounded-full border border-red-100">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-[#7B1A1A] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Check className="h-3 w-3" />
                  อ่านแล้วทั้งหมด
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {notifications.map((n) => {
                const Icon =
                  n.type === 'warning'
                    ? AlertTriangle
                    : n.type === 'error'
                    ? XCircle
                    : n.type === 'success'
                    ? CheckCircle2
                    : Info

                const iconBg =
                  n.type === 'warning'
                    ? 'bg-amber-50 text-amber-600 border-amber-100'
                    : n.type === 'error'
                    ? 'bg-red-50 text-[#7B1A1A] border-red-100'
                    : n.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-blue-50 text-blue-600 border-blue-100'

                return (
                  <div
                    key={n.id}
                    onClick={() => markSingleRead(n.id)}
                    className={`flex items-start gap-2.5 p-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !n.read ? 'bg-red-50/20' : ''
                    }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${iconBg} mt-0.5`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-bold leading-tight ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#7B1A1A] shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-tight">
                        {n.desc}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">{n.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer Popup */}
            <div className="p-1.5 border-t border-gray-100 bg-gray-50/50 text-center">
              <button
                onClick={() => router.push('/dashboard/notifications')}
                className="w-full py-1 text-xs font-bold text-[#7B1A1A] hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <span>ดูการแจ้งเตือนทั้งหมด</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-[1px] bg-gray-200" />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full p-1.5 pl-2 hover:bg-gray-50 border border-transparent hover:border-gray-200/60 transition-all outline-none group">
            <div className="relative">
              <Avatar className="h-8 w-8 ring-2 ring-red-100">
                <AvatarFallback className="bg-gradient-to-tr from-[#7B1A1A] to-[#9B3333] text-white text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-gray-800 leading-none group-hover:text-[#7B1A1A] transition-colors">
                {user.username}
              </p>
              <span className="inline-block mt-0.5 text-[10px] font-semibold text-[#7B1A1A] bg-red-50 px-1.5 py-0.2 rounded-md">
                {user.role}
              </span>
            </div>

            <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl border border-gray-200 bg-white shadow-lg">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-2">
                <p className="text-xs text-gray-400 font-normal">ลงชื่อเข้าใช้ด้วย</p>
                <p className="text-sm font-bold text-gray-800 capitalize mt-0.5">{user.username}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/profile')}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50"
              >
                <UserIcon className="h-4 w-4 text-gray-400" />
                ข้อมูลส่วนตัว
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50">
                <Shield className="h-4 w-4 text-gray-400" />
                สิทธิ์การใช้งาน ({user.role})
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/settings')}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                ตั้งค่าระบบ
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#7B1A1A] rounded-xl cursor-pointer hover:bg-red-50 focus:bg-red-50 focus:text-[#7B1A1A]"
              >
                <LogOut className="h-4 w-4 text-[#7B1A1A]" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
