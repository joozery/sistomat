import { Users, Cpu, ShieldCheck, Wrench, UserCheck } from 'lucide-react'
import { UserTable } from '@/components/pages/user-management/UserTable'

const stats = [
  { label: 'พนักงานทั้งหมด', value: '12 คน', icon: Users, color: 'text-gray-700 bg-gray-100', border: 'border-gray-200' },
  { label: 'ผู้ดูแลระบบ', value: '3 คน', icon: ShieldCheck, color: 'text-[#c62828] bg-red-50', border: 'border-red-100' },
  { label: 'ช่างเครื่องจักร', value: '7 คน', icon: Cpu, color: 'text-purple-700 bg-purple-50', border: 'border-purple-100' },
  { label: 'ฝ่าย QC / MAT', value: '4 คน', icon: Wrench, color: 'text-emerald-700 bg-emerald-50', border: 'border-emerald-100' },
]

export default function UserManagementPage() {
  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Stats Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c62828] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
              Human Resources
            </span>
            <span className="text-xs text-gray-400">/ สิทธิ์การใช้งาน</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            จัดการผู้ใช้งาน
            <UserCheck className="h-5 w-5 text-[#c62828]" />
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            บริหารจัดการรายชื่อพนักงาน กำหนดสิทธิ์การเข้าถึงเครื่องจักร และระดับผู้ดูแลระบบ
          </p>
        </div>

        {/* Stat cards */}
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
      </div>

      {/* Main Table */}
      <UserTable />
    </div>
  )
}
