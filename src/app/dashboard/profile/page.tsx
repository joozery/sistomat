'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  LogOut,
  Mail,
  Phone,
  Calendar,
  BadgeCheck,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    _cachedUser = { username: parsed.username || 'admin', role: parsed.role || 'Administrator' }
    return _cachedUser
  } catch {
    return DEFAULT_USER
  }
}

function subscribeToStorage(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl h-10 text-sm border-gray-200 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const user = useSyncExternalStore(
    subscribeToStorage,
    readUserFromStorage,
    () => DEFAULT_USER
  )

  // Editable contact info
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [email, setEmail] = useState(`${user.username}@sistomat.com`)
  const [phone, setPhone] = useState('081-234-5678')
  const [draftEmail, setDraftEmail] = useState(email)
  const [draftPhone, setDraftPhone] = useState(phone)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  const handleEditInfoOpen = () => {
    setDraftEmail(email)
    setDraftPhone(phone)
    setIsEditingInfo(true)
    setInfoMsg(null)
  }

  const handleSaveInfo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmail(draftEmail)
    setPhone(draftPhone)
    setIsEditingInfo(false)
    setInfoMsg('บันทึกข้อมูลเรียบร้อยแล้ว')
    setTimeout(() => setInfoMsg(null), 3000)
  }

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentPassword) {
      setPwMsg({ type: 'error', text: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
      return
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'รหัสผ่านใหม่ไม่ตรงกัน' })
      return
    }
    setPwMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth')
    localStorage.removeItem('user')
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/login')
  }

  const initials = user.username.charAt(0).toUpperCase()
  const joinDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 font-sans">

      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Account</p>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          โปรไฟล์ของฉัน
          <User className="h-5 w-5 text-[#7B1A1A]" />
        </h1>
      </div>

      {/* Profile Card — full width */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[#7B1A1A] via-red-500 to-rose-400" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7B1A1A] to-[#9B3333] text-white text-2xl font-bold shadow-lg ring-4 ring-white">
              {initials}
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="gap-2 rounded-full h-9 text-xs border-red-200 text-[#7B1A1A] hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              ออกจากระบบ
            </Button>
          </div>

          <h2 className="text-xl font-bold text-gray-900 capitalize">{user.username}</h2>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-3 py-0.5 text-xs font-semibold text-[#7B1A1A]">
              <ShieldCheck className="h-3 w-3" />
              {user.role}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
              <BadgeCheck className="h-3 w-3" />
              บัญชีใช้งานอยู่
            </span>
          </div>

          {/* Quick info pills */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-gray-400" />{email}</span>
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" />{phone}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />เข้าระบบล่าสุด: {joinDate}</span>
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left — Contact Info (3/5) */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">ข้อมูลส่วนตัว</h3>
                <p className="text-xs text-gray-400">อีเมล เบอร์โทรศัพท์ และข้อมูลผู้ใช้งาน</p>
              </div>
            </div>
            {!isEditingInfo && (
              <button
                onClick={handleEditInfoOpen}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                แก้ไข
              </button>
            )}
          </div>

          {isEditingInfo ? (
            <form onSubmit={handleSaveInfo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email" className="text-xs font-semibold text-gray-700">อีเมล</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    className="rounded-xl h-10 text-sm border-gray-200"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone" className="text-xs font-semibold text-gray-700">เบอร์โทรศัพท์</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={draftPhone}
                    onChange={(e) => setDraftPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="rounded-xl h-10 text-sm border-gray-200"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingInfo(false)}
                  className="gap-2 rounded-full h-9 text-xs border-gray-200"
                >
                  <X className="h-3.5 w-3.5" />
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="gap-2 rounded-full h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white px-5"
                >
                  <Save className="h-3.5 w-3.5" />
                  บันทึก
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: User,       label: 'ชื่อผู้ใช้งาน',     value: user.username, mono: true },
                { icon: ShieldCheck, label: 'ระดับสิทธิ์',       value: user.role },
                { icon: Mail,       label: 'อีเมล',              value: email },
                { icon: Phone,      label: 'เบอร์โทรศัพท์',     value: phone || '—' },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200">
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                    <p className={`text-sm font-bold text-gray-800 truncate capitalize ${mono ? 'font-mono' : ''}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {infoMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {infoMsg}
            </div>
          )}
        </div>

        {/* Right — Change Password (2/5) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">เปลี่ยนรหัสผ่าน</h3>
              <p className="text-xs text-gray-400">อย่างน้อย 6 ตัวอักษร</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw" className="text-xs font-semibold text-gray-700">รหัสผ่านปัจจุบัน</Label>
              <PasswordInput
                id="current-pw"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="กรอกรหัสผ่านปัจจุบัน"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pw" className="text-xs font-semibold text-gray-700">รหัสผ่านใหม่</Label>
              <PasswordInput
                id="new-pw"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="รหัสผ่านใหม่"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw" className="text-xs font-semibold text-gray-700">ยืนยันรหัสผ่านใหม่</Label>
              <PasswordInput
                id="confirm-pw"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="พิมพ์ซ้ำอีกครั้ง"
              />
            </div>

            {pwMsg && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-medium ${
                pwMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border border-red-100 text-[#7B1A1A]'
              }`}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {pwMsg.text}
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-full h-10 bg-amber-500 hover:bg-amber-600 text-white gap-2"
            >
              <KeyRound className="h-4 w-4" />
              บันทึกรหัสผ่านใหม่
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
