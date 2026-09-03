'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Cpu,
  Check,
  Trash2,
  ExternalLink,
  Filter,
  BellRing,
} from 'lucide-react'
import Link from 'next/link'

interface NotificationItem {
  id: number
  type: 'success' | 'warning' | 'error' | 'info'
  category: 'machine' | 'system' | 'qc' | 'inventory'
  title: string
  description: string
  time: string
  read: boolean
  link?: string
}

const initialNotifications: NotificationItem[] = [
  {
    id: 1,
    type: 'warning',
    category: 'machine',
    title: 'เครื่องจักร CNC 2 แจ้งเตือนตรวจเช็กน้ำมันหล่อเย็น',
    description: 'ระดับน้ำมันหล่อเย็นลดลงต่ำกว่า 20% กรุณาเติมก่อนเริ่มขั้นตอนการผลิตถัดไป',
    time: '10 นาทีที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
  },
  {
    id: 2,
    type: 'success',
    category: 'qc',
    title: 'การสแกน QR Code ใบงาน #JOB-8842 เสร็จสิ้น',
    description: 'ขั้นตอน LATHE 1 ดำเนินการเสร็จสมบูรณ์ ชิ้นงานผ่านการตรวจสอบคุณภาพเบื้องต้น 100%',
    time: '35 นาทีที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
  },
  {
    id: 3,
    type: 'error',
    category: 'qc',
    title: 'พบชิ้นงานไม่ผ่านเกณฑ์ QC ในขั้นตอน #JOB-8845',
    description: 'พบรอยขีดข่วนบนพื้นผิวชิ้นงานเกินค่าพิกัดความคลาดเคลื่อน 0.05 mm กรุณาตรวจสอบ',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
  },
  {
    id: 4,
    type: 'info',
    category: 'inventory',
    title: 'การเบิกจ่ายวัตถุดิบสำเร็จ (เหล็กเพลา S45C)',
    description: 'ฝ่าย MAT ดำเนินการเบิกจ่ายวัตถุดิบสำหรับแพลนงานประจำสัปดาห์เรียบร้อยแล้ว',
    time: '3 ชั่วโมงที่แล้ว',
    read: true,
  },
  {
    id: 5,
    type: 'info',
    category: 'system',
    title: 'อัปเดตระบบ SISTOMAT ERP v2.4 สำเร็จ',
    description: 'ปรับปรุงประสิทธิภาพการสแกน QR Code และเพิ่มความเร็วในการโหลดตารางกระบวนการ',
    time: 'เมื่อวานนี้',
    read: true,
  },
]

const iconMap = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', badge: 'สำเร็จ' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', badge: 'แจ้งเตือน' },
  error: { icon: XCircle, color: 'text-[#7B1A1A]', bg: 'bg-red-50 border-red-100', badge: 'ข้อผิดพลาด' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', badge: 'ข้อมูลระบบ' },
}

export function NotificationList() {
  const [list, setList] = useState<NotificationItem[]>(initialNotifications)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'machine'>('all')

  const toggleRead = (id: number) => {
    setList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: !item.read } : item))
    )
  }

  const markAllAsRead = () => {
    setList((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  const deleteItem = (id: number) => {
    setList((prev) => prev.filter((item) => item.id !== id))
  }

  const filteredList = list.filter((item) => {
    if (activeTab === 'unread') return !item.read
    if (activeTab === 'machine') return item.category === 'machine' || item.category === 'qc'
    return true
  })

  const unreadCount = list.filter((i) => !i.read).length

  return (
    <div className="space-y-4 font-sans">
      {/* Filter Tabs & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm/50">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-[#7B1A1A] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({list.length})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'unread'
                ? 'bg-[#7B1A1A] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ยังไม่อ่าน ({unreadCount})
          </button>
          <button
            onClick={() => setActiveTab('machine')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'machine'
                ? 'bg-[#7B1A1A] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            เครื่องจักร & QC
          </button>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full h-8 px-3"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            มาร์กอ่านแล้วทั้งหมด
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <Card className="rounded-xl border border-gray-100 bg-white p-12 text-center text-gray-400">
            <BellRing className="h-8 w-8 mx-auto mb-2 opacity-30 text-gray-400" />
            <p className="text-sm font-medium">ไม่มีรายการแจ้งเตือนในหมวดหมู่นี้</p>
          </Card>
        ) : (
          filteredList.map((note) => {
            const { icon: Icon, color, bg, badge } = iconMap[note.type]

            return (
              <Card
                key={note.id}
                className={`rounded-xl border transition-all duration-200 shadow-none hover:border-gray-200 ${
                  !note.read
                    ? 'bg-gradient-to-r from-red-50/30 via-white to-white border-red-100/90'
                    : 'bg-white border-gray-100'
                }`}
              >
                <CardContent className="flex items-start gap-4 p-4 md:p-5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${bg} mt-0.5`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {!note.read && (
                          <span className="h-2 w-2 rounded-full bg-[#7B1A1A] animate-pulse" />
                        )}
                        <h3 className={`text-sm font-bold ${!note.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {note.title}
                        </h3>
                        <Badge variant="outline" className={`rounded-full text-[10px] font-semibold px-2 py-0.2 ${bg} ${color}`}>
                          {badge}
                        </Badge>
                      </div>

                      <span className="text-xs text-gray-400 font-medium">{note.time}</span>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed">{note.description}</p>

                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100/80">
                      {note.link && (
                        <Link
                          href={note.link}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B1A1A] hover:underline"
                        >
                          <span>ตรวจสอบรายละเอียด</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}

                      <button
                        onClick={() => toggleRead(note.id)}
                        className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {note.read ? 'มาร์กยังไม่อ่าน' : 'มาร์กอ่านแล้ว'}
                      </button>

                      <button
                        onClick={() => deleteItem(note.id)}
                        className="text-xs font-medium text-gray-400 hover:text-[#7B1A1A] transition-colors ml-auto flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
