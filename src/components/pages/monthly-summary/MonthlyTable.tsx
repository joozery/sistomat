import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, FileText, ArrowUpRight } from 'lucide-react'

const tableRows = [
  { month: 'มกราคม 2568', orders: 52, qcPassed: '1,800 ชิ้น', hours: '235 ชม.', oee: '93.5%', status: 'บรรลุเป้าหมาย' },
  { month: 'กุมภาพันธ์ 2568', orders: 48, qcPassed: '1,650 ชิ้น', hours: '220 ชม.', oee: '91.8%', status: 'บรรลุเป้าหมาย' },
  { month: 'มีนาคม 2568', orders: 60, qcPassed: '2,100 ชิ้น', hours: '260 ชม.', oee: '95.2%', status: 'บรรลุเป้าหมาย' },
  { month: 'เมษายน 2568', orders: 55, qcPassed: '1,950 ชิ้น', hours: '240 ชม.', oee: '94.0%', status: 'บรรลุเป้าหมาย' },
  { month: 'พฤษภาคม 2568', orders: 65, qcPassed: '2,400 ชิ้น', hours: '275 ชม.', oee: '96.1%', status: 'เกินเป้าหมาย 15%' },
  { month: 'มิถุนายน 2568', orders: 68, qcPassed: '2,950 ชิ้น', hours: '290 ชม.', oee: '97.8%', status: 'สูงสุดในรอบปี' },
]

export function MonthlyTable() {
  return (
    <Card className="rounded-xl border border-gray-100 bg-white shadow-none font-sans overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#c62828]" />
            รายละเอียดสรุปผลการดำเนินงานรายเดือน
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            ตารางเปรียบเทียบจำนวนออเดอร์ ยอดผ่าน QC และประสิทธิภาพ OEE ประจำแต่ละเดือน
          </p>
        </div>

        <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#c62828] bg-red-50 border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">
          ดาวน์โหลดรายงาน Excel
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-gray-50/80">
            <TableRow className="hover:bg-transparent border-gray-100">
              <TableHead className="text-xs font-bold text-gray-500 uppercase px-6">ประจำเดือน</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">ออเดอร์ที่ส่งมอบ</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">ชิ้นงานผ่าน QC</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">ชั่วโมงเดินเครื่อง</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">ประสิทธิภาพ OEE</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center px-6">ผลการประเมิน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {tableRows.map((row) => (
              <TableRow key={row.month} className="hover:bg-red-50/20 transition-colors group">
                <TableCell className="font-semibold text-sm text-gray-800 px-6 group-hover:text-[#c62828] transition-colors">
                  {row.month}
                </TableCell>
                <TableCell className="text-center font-bold text-xs text-gray-700">
                  {row.orders} ออเดอร์
                </TableCell>
                <TableCell className="text-center font-bold text-xs text-emerald-700">
                  {row.qcPassed}
                </TableCell>
                <TableCell className="text-center text-xs font-mono text-gray-600">
                  {row.hours}
                </TableCell>
                <TableCell className="text-center font-extrabold text-xs text-[#c62828]">
                  {row.oee}
                </TableCell>
                <TableCell className="text-center px-6">
                  <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[11px] font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {row.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-6 py-3.5">
          <p className="text-xs text-gray-500">
            รวมทั้งสิ้น <span className="font-bold text-gray-800">348 ออเดอร์</span> (ผ่าน QC รวม <span className="font-bold text-emerald-700">12,850 ชิ้น</span>)
          </p>
          <span className="text-xs font-medium text-gray-400">ข้อมูลสิ้นสุดวันที่ 30 มิถุนายน 2568</span>
        </div>
      </CardContent>
    </Card>
  )
}
