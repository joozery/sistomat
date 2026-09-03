import { NotificationList } from '@/components/pages/notifications/NotificationList'
import { Bell, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7B1A1A] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
              <Bell className="h-3 w-3" /> SYSTEM NOTIFICATIONS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            ศูนย์การแจ้งเตือนระบบ
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            ติดตามการแจ้งเตือนสถานะการผลิต ข้อมูลเครื่องจักร รายงาน QC และการเบิกจ่ายวัตถุดิบ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50/70 border border-red-100 text-xs font-semibold text-[#7B1A1A]">
            <ShieldAlert className="h-4 w-4" />
            <span>มี 3 รายการสำคัญที่ยังไม่อ่าน</span>
          </div>
        </div>
      </div>

      {/* Main Notification List */}
      <NotificationList />
    </div>
  )
}
