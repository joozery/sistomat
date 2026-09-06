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
import { CheckCircle2, FileText, MinusCircle } from 'lucide-react'
import type { MonthData } from '@/app/dashboard/monthly-summary/page'

interface Props {
  months: MonthData[]
  year: number
}

function completionLabel(completed: number, total: number): { text: string; ok: boolean } {
  if (total === 0) return { text: 'ไม่มีข้อมูล', ok: false }
  const pct = (completed / total) * 100
  if (pct >= 100) return { text: 'ครบ 100%', ok: true }
  if (pct >= 90) return { text: `สำเร็จ ${pct.toFixed(0)}%`, ok: true }
  if (pct >= 70) return { text: `สำเร็จ ${pct.toFixed(0)}%`, ok: false }
  return { text: `สำเร็จ ${pct.toFixed(0)}%`, ok: false }
}

const MONTH_TH: Record<string, string> = {
  '01': 'มกราคม', '02': 'กุมภาพันธ์', '03': 'มีนาคม', '04': 'เมษายน',
  '05': 'พฤษภาคม', '06': 'มิถุนายน', '07': 'กรกฎาคม', '08': 'สิงหาคม',
  '09': 'กันยายน', '10': 'ตุลาคม', '11': 'พฤศจิกายน', '12': 'ธันวาคม',
}

export function MonthlyTable({ months, year }: Props) {
  const totalCompleted = months.reduce((s, m) => s + m.completed_jobs, 0)
  const totalAll = months.reduce((s, m) => s + m.total_jobs, 0)
  const totalQcPassed = months.reduce((s, m) => s + m.qc_passed, 0)
  const totalHours = months.reduce((s, m) => s + m.elapsed_hours, 0)

  const latestMonth = [...months].reverse().find((m) => m.total_jobs > 0)
  const latestLabel = latestMonth
    ? `${MONTH_TH[latestMonth.ym.slice(5)]} ${year + 543}`
    : `ธันวาคม ${year + 543}`

  const activeMonths = months.filter((m) => m.total_jobs > 0)

  return (
    <Card className="rounded-xl border border-gray-100 bg-white shadow-none font-sans overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-gray-100 px-6 py-4 bg-gray-50/40">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#7B1A1A]" />
            รายละเอียดสรุปผลการดำเนินงานรายเดือน
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            ตารางเปรียบเทียบจำนวนออเดอร์ ยอดผ่าน QC และชั่วโมงการทำงาน ประจำแต่ละเดือน ปี {year + 543}
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-gray-50/80">
            <TableRow className="hover:bg-transparent border-gray-100">
              <TableHead className="text-xs font-bold text-gray-500 uppercase px-6">ประจำเดือน</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">งานทั้งหมด</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">งานเสร็จ</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">QC ผ่าน</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center">ชั่วโมงทำงาน</TableHead>
              <TableHead className="text-xs font-bold text-gray-500 uppercase text-center px-6">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {activeMonths.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-10">
                  ไม่มีข้อมูลในปี {year + 543}
                </TableCell>
              </TableRow>
            ) : (
              activeMonths.map((row) => {
                const monthKey = row.ym.slice(5)
                const label = completionLabel(row.completed_jobs, row.total_jobs)
                return (
                  <TableRow key={row.ym} className="hover:bg-red-50/20 transition-colors group">
                    <TableCell className="font-semibold text-sm text-gray-800 px-6 group-hover:text-[#7B1A1A] transition-colors">
                      {MONTH_TH[monthKey]} {year + 543}
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-500 font-medium">
                      {row.total_jobs.toLocaleString()} รายการ
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-gray-700">
                      {row.completed_jobs.toLocaleString()} รายการ
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-emerald-700">
                      {row.qc_passed > 0 ? (
                        <>
                          {row.qc_passed.toLocaleString()} ชิ้น
                          {row.qc_pct != null && (
                            <span className="ml-1 text-[11px] text-gray-400">({row.qc_pct}%)</span>
                          )}
                        </>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono text-gray-600">
                      {row.elapsed_hours > 0 ? `${row.elapsed_hours.toLocaleString()} ชม.` : '—'}
                    </TableCell>
                    <TableCell className="text-center px-6">
                      {row.total_jobs === 0 ? (
                        <Badge variant="outline" className="rounded-full bg-gray-50 text-gray-400 border-gray-200 text-[11px] font-semibold">
                          <MinusCircle className="h-3 w-3 mr-1" />
                          ไม่มีข้อมูล
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`rounded-full gap-1 text-[11px] font-semibold ${
                            label.ok
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {label.text}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-6 py-3.5">
          <p className="text-xs text-gray-500">
            รวมทั้งสิ้น{' '}
            <span className="font-bold text-gray-800">{totalAll.toLocaleString()} รายการ</span>
            {' '}· เสร็จ{' '}
            <span className="font-bold text-[#7B1A1A]">{totalCompleted.toLocaleString()} รายการ</span>
            {totalQcPassed > 0 && (
              <> · QC ผ่าน <span className="font-bold text-emerald-700">{totalQcPassed.toLocaleString()} ชิ้น</span></>
            )}
            {totalHours > 0 && (
              <> · <span className="font-bold text-purple-700">{totalHours.toLocaleString()} ชม.</span></>
            )}
          </p>
          <span className="text-xs font-medium text-gray-400">
            ข้อมูลสิ้นสุดเดือน {latestLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
