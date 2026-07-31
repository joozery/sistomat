import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cpu, CheckCircle2, AlertTriangle, Clock, ArrowUpRight, QrCode } from 'lucide-react'
import Link from 'next/link'

const machineStatuses = [
  {
    name: 'LATHE 1',
    type: 'เครื่องกลึงอัตโนมัติ',
    operator: 'นายธณรัฐ การญจนเวทย์',
    status: 'กำลังผลิต',
    statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progress: 85,
    code: '#JOB-8842',
  },
  {
    name: 'CNC 2',
    type: 'เครื่องกัดแนวตั้ง CNC',
    operator: 'นายธีระยุทธ บ้านเปี่ยมขวัญ',
    status: 'กำลังผลิต',
    statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progress: 62,
    code: '#JOB-8845',
  },
  {
    name: 'CAM 1',
    type: 'สถานีออกแบบ CAM',
    operator: 'นายพัฒนชัย ชูใจ',
    status: 'สแตนด์บาย',
    statusBg: 'bg-amber-50 text-amber-700 border-amber-200',
    progress: 30,
    code: '#JOB-8849',
  },
  {
    name: 'QC & MAT 1',
    type: 'สถานีตรวจสอบคุณภาพ',
    operator: 'นายอาทิตย์ หุ่นสมบูรณ์',
    status: 'กำลังผลิต',
    statusBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progress: 94,
    code: '#JOB-8850',
  },
]

export function JobApplicationSection() {
  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#c62828]" />
            สถานะเครื่องจักรและแพลนงานที่กำลังดำเนินอยู่
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            อัปเดตแบบเรียลไทม์ตามการสแกน QR Code ประจำสถานี
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/process-qrcode"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#c62828] bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            สแกน QR Code
          </Link>
          <Link
            href="/dashboard/all-plans"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ดูทั้งหมด
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {machineStatuses.map((machine) => (
            <div
              key={machine.name}
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:bg-white hover:border-gray-200 hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-[#c62828]">{machine.code}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${machine.statusBg}`}>
                  {machine.status}
                </span>
              </div>

              <h4 className="text-sm font-bold text-gray-800">{machine.name}</h4>
              <p className="text-[11px] text-gray-400 mb-3">{machine.type}</p>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-medium">ผู้คุมเครื่อง:</span>
                  <span className="font-semibold text-gray-700 truncate max-w-[120px]">
                    {machine.operator}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                    <span>ความคืบหน้า</span>
                    <span>{machine.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#c62828] to-[#ef5350] rounded-full transition-all duration-500"
                      style={{ width: `${machine.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
