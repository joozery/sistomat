'use client'

import { useState } from 'react'
import {
  Search,
  Pencil,
  Trash2,
  UserPlus,
  MoreHorizontal,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  Mail,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface UserItem {
  id: number
  code: number
  name: string
  password: string
  email: string
  phone: string
  machines: string[]
}

const initialUsers: UserItem[] = [
  { id: 1,  code: 335, name: 'นายธณรัฐ การญจนเวทย์',      password: '••••••••', email: 'user335@sistomat.com', phone: '081-234-5601', machines: ['SPAR', 'LATHE 2', 'ML'] },
  { id: 2,  code: 361, name: 'นายอาชวัตร ยิ้มโภชน์',      password: '••••••••', email: 'user361@sistomat.com', phone: '082-345-6102', machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { id: 3,  code: 367, name: 'นายธีระยุทธ บ้านเปี่ยมขวัญ', password: '••••••••', email: 'user367@sistomat.com', phone: '083-456-7103', machines: ['CNC 1', 'CNC 2'] },
  { id: 4,  code: 395, name: 'น.ส.จิรัชพร ปานอร่ามวงศ์',  password: '••••••••', email: 'user395@sistomat.com', phone: '084-567-8104', machines: ['ADMIN 1', 'MAT'] },
  { id: 5,  code: 407, name: 'นายณัฐพงศ์ เปล่งพานิช',     password: '••••••••', email: 'user407@sistomat.com', phone: '085-678-9105', machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { id: 6,  code: 413, name: 'นายอาทิตย์ หุ่นสมบูรณ์',    password: '••••••••', email: 'user413@sistomat.com', phone: '086-789-0106', machines: ['ADMIN 2', 'MAT', 'QC'] },
  { id: 7,  code: 417, name: 'นายกิตติคุณ สุขเกษม',       password: '••••••••', email: 'user417@sistomat.com', phone: '087-890-1107', machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { id: 8,  code: 419, name: 'นายจารุเดช ปัทมราช',        password: '••••••••', email: 'user419@sistomat.com', phone: '088-901-2108', machines: ['CNC 4'] },
  { id: 9,  code: 421, name: 'นายพีระพัฒน์ ทับสาร',       password: '••••••••', email: 'user421@sistomat.com', phone: '089-012-3109', machines: ['CNC 3', 'CNC 4'] },
  { id: 10, code: 451, name: 'น.ส.ณปภัช มโนรส',           password: '••••••••', email: 'user451@sistomat.com', phone: '081-123-4510', machines: ['QC', 'ADMIN 3'] },
  { id: 11, code: 452, name: 'นายจิรพงษ์ พงศ์ภานิช',      password: '••••••••', email: 'user452@sistomat.com', phone: '082-234-5611', machines: ['CAM 2', 'CNC 3', 'CNC 5'] },
  { id: 12, code: 453, name: 'นายพัฒนชัย ชูใจ',           password: '••••••••', email: 'user453@sistomat.com', phone: '083-345-6712', machines: ['CAM 1', 'CNC 1', 'CNC 2'] },
]

const avatarGradients = [
  'from-red-500 to-rose-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-blue-500',
  'from-pink-500 to-rose-600',
]

function getInitials(name: string) {
  const clean = name.replace(/^(นาย|น\.ส\.|นาง|คุณ)\s?/, '')
  return clean.charAt(0)
}

function getPrimaryRole(machines: string[]) {
  if (machines.some((m) => m.includes('ADMIN'))) return { label: 'ผู้ดูแลระบบ',   color: 'text-[#c62828] bg-red-50 border-red-100' }
  if (machines.some((m) => m.includes('CAM')))   return { label: 'ช่าง CAM',       color: 'text-blue-700 bg-blue-50 border-blue-100' }
  if (machines.some((m) => m.includes('CNC')))   return { label: 'ช่าง CNC',       color: 'text-purple-700 bg-purple-50 border-purple-100' }
  if (machines.some((m) => m.includes('LATHE'))) return { label: 'ช่างกลึง',       color: 'text-amber-700 bg-amber-50 border-amber-100' }
  if (machines.some((m) => m.includes('QC')))    return { label: 'เจ้าหน้าที่ QC', color: 'text-rose-700 bg-rose-50 border-rose-100' }
  if (machines.some((m) => m.includes('MAT')))   return { label: 'ฝ่ายวัตถุดิบ',  color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }
  return { label: 'พนักงาน', color: 'text-gray-700 bg-gray-50 border-gray-200' }
}

function getMachineBadge(machine: string) {
  if (machine.includes('LATHE')) return 'bg-amber-50 text-amber-800 border-amber-200/80'
  if (machine.includes('CNC'))   return 'bg-purple-50 text-purple-800 border-purple-200/80'
  if (machine.includes('ADMIN')) return 'bg-red-50 text-[#c62828] border-red-200/80'
  if (machine.includes('MAT'))   return 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
  if (machine.includes('QC'))    return 'bg-rose-50 text-rose-800 border-rose-200/80'
  if (machine.includes('CAM'))   return 'bg-blue-50 text-blue-800 border-blue-200/80'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
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
        required={required}
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

export function UserTable() {
  const [usersList, setUsersList] = useState<UserItem[]>(initialUsers)
  const [search, setSearch] = useState('')

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newMachines, setNewMachines] = useState('')

  // Edit dialog
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMachines, setEditMachines] = useState('')

  const filtered = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      String(u.code).includes(search) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newName || !newCode || !newPassword) return
    setUsersList([
      {
        id: Date.now(),
        code: parseInt(newCode) || 999,
        name: newName,
        password: newPassword,
        email: newEmail || `user${newCode}@sistomat.com`,
        phone: newPhone,
        machines: newMachines ? newMachines.split(',').map((m) => m.trim()) : ['MAT'],
      },
      ...usersList,
    ])
    setNewName('')
    setNewCode('')
    setNewPassword('')
    setNewEmail('')
    setNewPhone('')
    setNewMachines('')
    setIsAddOpen(false)
  }

  const handleEditClick = (user: UserItem) => {
    setEditingUser(user)
    setEditName(user.name)
    setEditCode(String(user.code))
    setEditPassword('')
    setEditEmail(user.email)
    setEditPhone(user.phone)
    setEditMachines(user.machines.join(', '))
  }

  const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser || !editName || !editCode) return
    setUsersList(
      usersList.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              name: editName,
              code: parseInt(editCode) || u.code,
              password: editPassword || u.password,
              email: editEmail || u.email,
              phone: editPhone,
              machines: editMachines
                ? editMachines.split(',').map((m) => m.trim())
                : u.machines,
            }
          : u
      )
    )
    setEditingUser(null)
  }

  const handleDeleteUser = (id: number) => {
    setUsersList(usersList.filter((u) => u.id !== id))
  }

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาชื่อ หรือรหัสพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-full border-gray-200 bg-white text-sm focus:border-[#c62828] transition-all"
          />
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="gap-2 rounded-full h-10 bg-[#c62828] hover:bg-[#b71c1c] text-white px-5 shadow-sm transition-all"
        >
          <UserPlus className="h-4 w-4" />
          <span>เพิ่มผู้ใช้งาน</span>
        </Button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader className="bg-gray-50/80">
          <TableRow className="hover:bg-transparent border-gray-100">
            <TableHead className="w-12 text-center text-xs font-bold text-gray-400 uppercase">#</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">ข้อมูลพนักงาน</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">ตำแหน่ง / บทบาท</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">สิทธิ์เครื่องจักร</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-24">จัดการ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Search className="h-6 w-6 opacity-30" />
                  <p className="text-sm">ไม่พบข้อมูลพนักงานที่ค้นหา</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((user, i) => {
              const role = getPrimaryRole(user.machines)
              const gradient = avatarGradients[user.id % avatarGradients.length]
              const initials = getInitials(user.name)
              return (
                <TableRow key={user.id} className="hover:bg-red-50/20 transition-colors group">
                  <TableCell className="text-xs font-bold text-gray-400 text-center">
                    {String(i + 1).padStart(2, '0')}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white text-xs font-bold shadow-sm`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#c62828] transition-colors">
                          {user.name}
                        </p>
                        <p className="text-[11px] font-mono text-gray-400">รหัส: #{user.code}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Mail className="h-2.5 w-2.5" />{user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Phone className="h-2.5 w-2.5" />{user.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${role.color}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {role.label}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.machines.map((m) => (
                        <span
                          key={m}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getMachineBadge(m)}`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors outline-none">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl bg-white border border-gray-200">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs text-gray-400">การดำเนินการ</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleEditClick(user)}
                            className="gap-2 text-xs font-medium cursor-pointer rounded-lg"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-600" />
                            แก้ไขข้อมูล
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.id)}
                            className="gap-2 text-xs font-semibold text-[#c62828] cursor-pointer rounded-lg hover:bg-red-50 focus:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#c62828]" />
                            ลบผู้ใช้งาน
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-6 py-3.5">
        <p className="text-xs text-gray-500">
          แสดงข้อมูล <span className="font-bold text-gray-800">{filtered.length}</span> รายการ จากทั้งหมด{' '}
          <span className="font-bold text-gray-800">{usersList.length}</span> รายการ
        </p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-500">อัปเดตข้อมูลล่าสุดเมื่อสักครู่</span>
        </div>
      </div>

      {/* ── Add User Dialog ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#c62828]" />
              เพิ่มผู้ใช้งานใหม่
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              กรอกข้อมูลพนักงานใหม่ รหัสผ่าน และสิทธิ์เครื่องจักรในระบบ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-name" className="text-xs font-semibold text-gray-700">ชื่อ-นามสกุล</Label>
                <Input
                  id="add-name"
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-code" className="text-xs font-semibold text-gray-700">รหัสพนักงาน</Label>
                <Input
                  id="add-code"
                  type="number"
                  placeholder="เช่น 499"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-password" className="text-xs font-semibold text-gray-700">รหัสผ่าน</Label>
                <PasswordInput
                  id="add-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="รหัสผ่านเริ่มต้น"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-email" className="text-xs font-semibold text-gray-700">อีเมล</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="email@sistomat.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-phone" className="text-xs font-semibold text-gray-700">เบอร์โทรศัพท์</Label>
                <Input
                  id="add-phone"
                  type="tel"
                  placeholder="08x-xxx-xxxx"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-machines" className="text-xs font-semibold text-gray-700">
                  สิทธิ์เครื่องจักร
                  <span className="ml-1 font-normal text-gray-400">(คั่นด้วยจุลภาค)</span>
                </Label>
                <Input
                  id="add-machines"
                  placeholder="เช่น CNC 1, LATHE 2, QC"
                  value={newMachines}
                  onChange={(e) => setNewMachines(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="rounded-full h-10 border-gray-200"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="rounded-full h-10 bg-[#c62828] hover:bg-[#b71c1c] text-white px-6"
              >
                บันทึกข้อมูล
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null) }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              แก้ไขข้อมูลพนักงาน
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              แก้ไขข้อมูลได้ตามต้องการ — เว้นรหัสผ่านว่างไว้หากไม่ต้องการเปลี่ยน
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold text-gray-700">ชื่อ-นามสกุล</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-code" className="text-xs font-semibold text-gray-700">รหัสพนักงาน</Label>
                <Input
                  id="edit-code"
                  type="number"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-password" className="text-xs font-semibold text-gray-700">
                  รหัสผ่านใหม่
                  <span className="ml-1 font-normal text-gray-400">(เว้นว่างถ้าไม่เปลี่ยน)</span>
                </Label>
                <PasswordInput
                  id="edit-password"
                  value={editPassword}
                  onChange={setEditPassword}
                  placeholder="เว้นว่างไว้หากไม่เปลี่ยน"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs font-semibold text-gray-700">อีเมล</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-xs font-semibold text-gray-700">เบอร์โทรศัพท์</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="08x-xxx-xxxx"
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-machines" className="text-xs font-semibold text-gray-700">
                  สิทธิ์เครื่องจักร
                  <span className="ml-1 font-normal text-gray-400">(คั่นด้วยจุลภาค)</span>
                </Label>
                <Input
                  id="edit-machines"
                  value={editMachines}
                  onChange={(e) => setEditMachines(e.target.value)}
                  className="rounded-xl h-10 text-sm border-gray-200"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                className="rounded-full h-10 border-gray-200"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="rounded-full h-10 bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                บันทึกการแก้ไข
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
