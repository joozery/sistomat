'use client'

import { useState } from 'react'
import {
  Settings,
  Bell,
  Shield,
  Monitor,
  Building2,
  CheckCircle2,
  Save,
  Clock,
  Mail,
  Smartphone,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/* ── Toggle Switch ── */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#c62828]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/* ── Section Card ── */
function Section({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

/* ── Toggle Row ── */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)

  /* General */
  const [companyName, setCompanyName] = useState('Sistomat Ltd.')
  const [systemName, setSystemName] = useState('Sistomat ERP')
  const [timezone, setTimezone] = useState('Asia/Bangkok')

  /* Notifications */
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)
  const [notifyOverdue, setNotifyOverdue] = useState(true)
  const [notifyNewJob, setNotifyNewJob] = useState(false)
  const [notifyDailyReport, setNotifyDailyReport] = useState(true)

  /* Display */
  const [dateFormat, setDateFormat] = useState('th-TH')
  const [compactMode, setCompactMode] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  /* Security */
  const [sessionTimeout, setSessionTimeout] = useState('480')
  const [require2fa, setRequire2fa] = useState(false)
  const [logActivity, setLogActivity] = useState(true)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 font-sans">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">System</p>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            ตั้งค่าระบบ
            <Settings className="h-5 w-5 text-[#c62828]" />
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold animate-in fade-in-0">
              <CheckCircle2 className="h-4 w-4" />
              บันทึกการตั้งค่าแล้ว
            </div>
          )}
          <Button
            onClick={handleSave}
            className="gap-2 rounded-full h-10 bg-[#c62828] hover:bg-[#b71c1c] text-white px-5 text-sm font-semibold shadow-sm"
          >
            <Save className="h-4 w-4" />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── General ── */}
        <Section
          icon={Building2}
          iconBg="bg-blue-50 border-blue-100"
          iconColor="text-blue-600"
          title="ข้อมูลองค์กร"
          description="ชื่อบริษัท ชื่อระบบ และเขตเวลา"
        >
          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-xs font-semibold text-gray-700">ชื่อบริษัท</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="rounded-xl h-10 text-sm border-gray-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sysname" className="text-xs font-semibold text-gray-700">ชื่อระบบ</Label>
            <Input
              id="sysname"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="rounded-xl h-10 text-sm border-gray-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz" className="text-xs font-semibold text-gray-700">เขตเวลา (Timezone)</Label>
            <select
              id="tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#c62828] focus:outline-none transition-colors"
            >
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              <option value="UTC">UTC (UTC+0)</option>
            </select>
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section
          icon={Bell}
          iconBg="bg-amber-50 border-amber-100"
          iconColor="text-amber-600"
          title="การแจ้งเตือน"
          description="กำหนดช่องทางและเงื่อนไขการแจ้งเตือน"
        >
          <ToggleRow
            label="แจ้งเตือนทางอีเมล"
            description="ส่งสรุปรายงานและการแจ้งเตือนสำคัญทางอีเมล"
            checked={notifyEmail}
            onChange={setNotifyEmail}
          />
          <ToggleRow
            label="แจ้งเตือน Push Notification"
            description="แจ้งเตือนในแอปแบบ real-time"
            checked={notifyPush}
            onChange={setNotifyPush}
          />
          <ToggleRow
            label="แจ้งเตือนงานเกินกำหนด"
            description="แจ้งเตือนเมื่อใบงานเกินวันกำหนดส่ง"
            checked={notifyOverdue}
            onChange={setNotifyOverdue}
          />
          <ToggleRow
            label="แจ้งเตือนเมื่อมีใบงานใหม่"
            checked={notifyNewJob}
            onChange={setNotifyNewJob}
          />
          <ToggleRow
            label="รายงานประจำวัน"
            description="สรุปสถิติการผลิตส่งให้ทุกเช้า 08:00"
            checked={notifyDailyReport}
            onChange={setNotifyDailyReport}
          />
        </Section>

        {/* ── Display ── */}
        <Section
          icon={Monitor}
          iconBg="bg-purple-50 border-purple-100"
          iconColor="text-purple-600"
          title="การแสดงผล"
          description="รูปแบบวันที่ เลย์เอาต์ และ UI"
        >
          <div className="space-y-1.5">
            <Label htmlFor="datefmt" className="text-xs font-semibold text-gray-700">รูปแบบวันที่</Label>
            <select
              id="datefmt"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#c62828] focus:outline-none transition-colors"
            >
              <option value="th-TH">ไทย — วันที่ เดือน ปี พ.ศ.</option>
              <option value="en-GB">อังกฤษ — DD/MM/YYYY</option>
              <option value="en-US">อเมริกัน — MM/DD/YYYY</option>
            </select>
          </div>
          <ToggleRow
            label="Compact Mode"
            description="ลดขนาด padding และ font เพื่อแสดงข้อมูลได้มากขึ้น"
            checked={compactMode}
            onChange={setCompactMode}
          />
          <ToggleRow
            label="แสดง Sidebar อัตโนมัติ"
            description="เปิด sidebar ทุกครั้งที่เข้าสู่ระบบ"
            checked={showSidebar}
            onChange={setShowSidebar}
          />

          {/* Info note */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-blue-50/60 border border-blue-100 px-4 py-3 mt-2">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">บางการตั้งค่าจะมีผลหลังจาก refresh หน้าเว็บ</p>
          </div>
        </Section>

        {/* ── Security ── */}
        <Section
          icon={Shield}
          iconBg="bg-red-50 border-red-100"
          iconColor="text-[#c62828]"
          title="ความปลอดภัย"
          description="Session, 2FA และ activity log"
        >
          <div className="space-y-1.5">
            <Label htmlFor="timeout" className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              หมดเวลา Session (นาที)
            </Label>
            <Input
              id="timeout"
              type="number"
              min="15"
              max="1440"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              className="rounded-xl h-10 text-sm border-gray-200"
            />
            <p className="text-[11px] text-gray-400">ปัจจุบัน: {Math.floor(Number(sessionTimeout) / 60)} ชั่วโมง {Number(sessionTimeout) % 60} นาที</p>
          </div>

          <ToggleRow
            label="เปิดใช้ Two-Factor Authentication"
            description="ผู้ใช้ต้องยืนยัน OTP เมื่อเข้าสู่ระบบ"
            checked={require2fa}
            onChange={setRequire2fa}
          />
          <ToggleRow
            label="บันทึก Activity Log"
            description="เก็บประวัติการเข้าใช้งานและการแก้ไขข้อมูล"
            checked={logActivity}
            onChange={setLogActivity}
          />

          {require2fa && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50/80 border border-amber-100 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">การเปิด 2FA จะต้องตั้งค่า authenticator app ด้วย — ติดต่อผู้ดูแลระบบ</p>
            </div>
          )}
        </Section>

      </div>

      {/* Contact channels info */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
            <Mail className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">ช่องทางการแจ้งเตือน</h3>
            <p className="text-xs text-gray-400">อีเมลและเบอร์โทรสำหรับรับการแจ้งเตือนระบบ</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="notify-email" className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              อีเมลสำหรับรับแจ้งเตือน
            </Label>
            <Input
              id="notify-email"
              type="email"
              defaultValue="admin@sistomat.com"
              className="rounded-xl h-10 text-sm border-gray-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notify-phone" className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-gray-400" />
              เบอร์โทร (SMS Alert)
            </Label>
            <Input
              id="notify-phone"
              type="tel"
              defaultValue="081-234-5678"
              className="rounded-xl h-10 text-sm border-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Bottom Save */}
      <div className="flex justify-end pb-4">
        <Button
          onClick={handleSave}
          className="gap-2 rounded-full h-11 bg-[#c62828] hover:bg-[#b71c1c] text-white px-8 text-sm font-bold shadow-md shadow-red-500/20"
        >
          <Save className="h-4 w-4" />
          บันทึกการตั้งค่าทั้งหมด
        </Button>
      </div>

    </div>
  )
}
