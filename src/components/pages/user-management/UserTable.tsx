'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Pencil, Trash2, UserPlus, MoreHorizontal,
  CheckCircle2, Sparkles, Eye, EyeOff, Mail, Phone, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface UserItem {
  _id: string
  username: string
  role: string
  name?: string
  code?: number
  email?: string
  phone?: string
  machines?: string[]
  created_at?: string
}

const ROLE_OPTIONS = ['Admin', 'User', 'QC', 'MAT']

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
  const clean = (name || '').replace(/^(นาย|น\.ส\.|นาง|คุณ)\s?/, '')
  return clean.charAt(0) || '?'
}

function getRoleBadge(role: string) {
  if (role === 'Admin') return 'text-[#7B1A1A] bg-red-50 border-red-100'
  if (role === 'QC')    return 'text-rose-700 bg-rose-50 border-rose-100'
  if (role === 'MAT')   return 'text-emerald-700 bg-emerald-50 border-emerald-100'
  return 'text-gray-700 bg-gray-50 border-gray-200'
}

function getMachineBadge(machine: string) {
  if (machine.includes('LATHE')) return 'bg-amber-50 text-amber-800 border-amber-200/80'
  if (machine.includes('CNC'))   return 'bg-purple-50 text-purple-800 border-purple-200/80'
  if (machine.includes('ADMIN')) return 'bg-red-50 text-[#7B1A1A] border-red-200/80'
  if (machine.includes('MAT'))   return 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
  if (machine.includes('QC'))    return 'bg-rose-50 text-rose-800 border-rose-200/80'
  if (machine.includes('CAM'))   return 'bg-blue-50 text-blue-800 border-blue-200/80'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

function PasswordInput({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-xl h-10 text-sm border-gray-200 pr-10" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl h-10 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[#7B1A1A] transition-all">
      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  )
}

export function UserTable() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'User', name: '', code: '', email: '', phone: '', machines: '' })

  // Edit dialog
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'User', name: '', code: '', email: '', phone: '', machines: '' })

  // Delete confirm
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (Array.isArray(data.users)) setUsers(data.users)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = users.filter((u) =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    String(u.code ?? '').includes(search)
  )

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...addForm,
          code: addForm.code ? Number(addForm.code) : null,
          machines: addForm.machines ? addForm.machines.split(',').map((m) => m.trim()).filter(Boolean) : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setIsAddOpen(false)
      setAddForm({ username: '', password: '', role: 'User', name: '', code: '', email: '', phone: '', machines: '' })
      await fetchUsers()
    } finally { setSaving(false) }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          id: editingUser._id,
          ...editForm,
          code: editForm.code ? Number(editForm.code) : null,
          machines: editForm.machines ? editForm.machines.split(',').map((m) => m.trim()).filter(Boolean) : [],
          password: editForm.password || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setEditingUser(null)
      await fetchUsers()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setSaving(true)
    try {
      await fetch(`/api/users?id=${deletingUser._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setDeletingUser(null)
      await fetchUsers()
    } finally { setSaving(false) }
  }

  const openEdit = (u: UserItem) => {
    setEditingUser(u)
    setEditForm({
      username: u.username,
      password: '',
      role: u.role,
      name: u.name || '',
      code: u.code ? String(u.code) : '',
      email: u.email || '',
      phone: u.phone || '',
      machines: (u.machines || []).join(', '),
    })
    setError('')
  }

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อ หรือ username..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-full border-gray-200 bg-white text-sm focus:border-[#7B1A1A] transition-all" />
        </div>
        <Button onClick={() => { setIsAddOpen(true); setError('') }}
          className="gap-2 rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-5 shadow-sm">
          <UserPlus className="h-4 w-4" />
          เพิ่มผู้ใช้งาน
        </Button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader className="bg-gray-50/80">
          <TableRow className="hover:bg-transparent border-gray-100">
            <TableHead className="w-12 text-center text-xs font-bold text-gray-400 uppercase">#</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">ข้อมูลผู้ใช้งาน</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">บทบาท</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase">สิทธิ์เครื่องจักร</TableHead>
            <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-24">จัดการ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100">
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#7B1A1A] mx-auto" />
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Search className="h-6 w-6 opacity-30" />
                  <p className="text-sm">ไม่พบข้อมูลผู้ใช้งาน</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((u, i) => {
              const gradient = avatarGradients[i % avatarGradients.length]
              const initials = getInitials(u.name || u.username)
              return (
                <TableRow key={u._id} className="hover:bg-red-50/20 transition-colors group">
                  <TableCell className="text-xs font-bold text-gray-400 text-center">
                    {String(i + 1).padStart(2, '0')}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white text-xs font-bold shadow-sm`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#7B1A1A] transition-colors">
                          {u.name || u.username}
                        </p>
                        <p className="text-[11px] font-mono text-gray-400">
                          @{u.username}{u.code ? ` · รหัส #${u.code}` : ''}
                        </p>
                        {(u.email || u.phone) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {u.email && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Mail className="h-2.5 w-2.5" />{u.email}
                              </span>
                            )}
                            {u.phone && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Phone className="h-2.5 w-2.5" />{u.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadge(u.role)}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {u.role}
                    </span>
                  </TableCell>

                  <TableCell>
                    {(u.machines || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(u.machines || []).map((m) => (
                          <span key={m} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getMachineBadge(m)}`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-gray-300">—</span>}
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
                          <DropdownMenuItem onClick={() => openEdit(u)}
                            className="gap-2 text-xs font-medium cursor-pointer rounded-lg">
                            <Pencil className="h-3.5 w-3.5 text-blue-600" />
                            แก้ไขข้อมูล
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletingUser(u)}
                            className="gap-2 text-xs font-semibold text-[#7B1A1A] cursor-pointer rounded-lg hover:bg-red-50 focus:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-[#7B1A1A]" />
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
          แสดง <span className="font-bold text-gray-800">{filtered.length}</span> / <span className="font-bold text-gray-800">{users.length}</span> รายการ
        </p>
      </div>

      {/* ── Add Dialog ── */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) setIsAddOpen(false) }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#7B1A1A]" /> เพิ่มผู้ใช้งานใหม่
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              กรอกข้อมูลผู้ใช้งาน บทบาท และสิทธิ์เครื่องจักร
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <form onSubmit={handleAdd} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">ชื่อ-นามสกุล</Label>
                <Input placeholder="เช่น นายสมชาย ใจดี" value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Username <span className="text-red-500">*</span></Label>
                <Input placeholder="เช่น somchai" value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">รหัสผ่าน <span className="text-red-500">*</span></Label>
                <PasswordInput id="add-pw" value={addForm.password}
                  onChange={(v) => setAddForm({ ...addForm, password: v })}
                  placeholder="รหัสผ่านเริ่มต้น" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">บทบาท</Label>
                <RoleSelect value={addForm.role} onChange={(v) => setAddForm({ ...addForm, role: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">รหัสพนักงาน</Label>
                <Input type="number" placeholder="เช่น 499" value={addForm.code}
                  onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">อีเมล</Label>
                <Input type="email" placeholder="email@sistomat.com" value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">เบอร์โทร</Label>
                <Input type="tel" placeholder="08x-xxx-xxxx" value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  สิทธิ์เครื่องจักร <span className="font-normal text-gray-400">(คั่นด้วยจุลภาค)</span>
                </Label>
                <Input placeholder="เช่น CNC 1, LATHE 2, QC" value={addForm.machines}
                  onChange={(e) => setAddForm({ ...addForm, machines: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
            </div>
            <DialogFooter className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}
                className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
              <Button type="submit" disabled={saving}
                className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึกข้อมูล'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null) }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" /> แก้ไขข้อมูลผู้ใช้งาน
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs mt-1">
              เว้นรหัสผ่านว่างไว้หากไม่ต้องการเปลี่ยน
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <form onSubmit={handleEdit} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">ชื่อ-นามสกุล</Label>
                <Input value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Username</Label>
                <Input value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  รหัสผ่านใหม่ <span className="font-normal text-gray-400">(เว้นว่างถ้าไม่เปลี่ยน)</span>
                </Label>
                <PasswordInput id="edit-pw" value={editForm.password}
                  onChange={(v) => setEditForm({ ...editForm, password: v })}
                  placeholder="รหัสผ่านใหม่" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">บทบาท</Label>
                <RoleSelect value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">รหัสพนักงาน</Label>
                <Input type="number" value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">อีเมล</Label>
                <Input type="email" value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">เบอร์โทร</Label>
                <Input type="tel" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  สิทธิ์เครื่องจักร <span className="font-normal text-gray-400">(คั่นด้วยจุลภาค)</span>
                </Label>
                <Input value={editForm.machines}
                  onChange={(e) => setEditForm({ ...editForm, machines: e.target.value })}
                  className="rounded-xl h-10 text-sm border-gray-200" />
              </div>
            </div>
            <DialogFooter className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}
                className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
              <Button type="submit" disabled={saving}
                className="rounded-full h-10 bg-blue-600 hover:bg-blue-700 text-white px-6">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึกการแก้ไข'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deletingUser} onOpenChange={(o) => { if (!o) setDeletingUser(null) }}>
        <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-800">ยืนยันการลบ</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              ต้องการลบผู้ใช้งาน <span className="font-semibold text-gray-700">{deletingUser?.name || deletingUser?.username}</span> ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}
              className="rounded-full h-10 border-gray-200">ยกเลิก</Button>
            <Button onClick={handleDelete} disabled={saving}
              className="rounded-full h-10 bg-[#7B1A1A] hover:bg-[#5C1212] text-white px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ลบผู้ใช้งาน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
