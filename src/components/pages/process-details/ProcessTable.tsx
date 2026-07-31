'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Clock, Trash2, Cpu } from 'lucide-react'

export const processOptions = [
  'MATERAIL', 'QC', 'CAM1', 'CNC1', 'ML', 'QC FN', 'เสร็จงาน',
  'CNC SPAR', 'CAM 1', 'CAM 2', 'CNC 1', 'CNC 2',
]

export interface ProcessRow {
  id: number
  process: string
  target_time: string
  worker_id: string
  start_time: string
  stop_time: string
  elapsed_time: string
  remark: string
}

interface ProcessTableProps {
  processList: ProcessRow[]
  onChange: (index: number, field: keyof ProcessRow, value: string) => void
  onAddRow: () => void
  onDeleteRow?: (index: number) => void
}

export function ProcessTable({ processList, onChange, onAddRow, onDeleteRow }: ProcessTableProps) {
  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-gray-100 px-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#c62828]" />
            ตารางลงเวลาและขั้นตอนกระบวนการผลิต
          </CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">
            บันทึกเวลาเริ่ม-หยุด และคำนวณระยะเวลาปฏิบัติงานของแต่ละสถานี
          </p>
        </div>

        <Button
          onClick={onAddRow}
          size="sm"
          className="gap-1.5 rounded-full h-9 bg-[#c62828] hover:bg-[#b71c1c] text-white px-4 text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มกระบวนการ</span>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="hover:bg-transparent border-gray-100">
                <TableHead className="w-14 text-center text-xs font-bold text-gray-400 uppercase">ลำดับ</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase min-w-[140px]">กระบวนการ</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-24">เป้าหมาย (ชม.)</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-28">รหัสพนักงาน</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-32">เวลาเริ่ม</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-32">เวลาหยุด</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center w-28">รวมเวลา</TableHead>
                <TableHead className="text-xs font-bold text-gray-500 uppercase text-center min-w-[120px]">หมายเหตุ</TableHead>
                {onDeleteRow && <TableHead className="w-12 text-center text-xs font-bold text-gray-400 uppercase">ลบ</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100">
              {processList.map((row, index) => {
                const isRunning = Boolean(row.start_time && !row.stop_time)

                return (
                  <TableRow key={row.id || index} className="hover:bg-red-50/20 transition-colors">
                    <TableCell className="text-center font-bold text-xs text-gray-400">
                      {String(index + 1).padStart(2, '0')}
                    </TableCell>

                    <TableCell>
                      <Select
                        value={row.process}
                        onValueChange={(val) => onChange(index, 'process', val ?? '')}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200 bg-gray-50/50 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200">
                          {processOptions.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs font-medium cursor-pointer">
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row.target_time}
                        onChange={(e) => onChange(index, 'target_time', e.target.value)}
                        className="h-9 text-xs text-center rounded-xl border-gray-200 bg-gray-50/50"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row.worker_id}
                        onChange={(e) => onChange(index, 'worker_id', e.target.value)}
                        className="h-9 text-xs text-center rounded-xl border-gray-200 bg-gray-50/50"
                        placeholder="รหัสพนักงาน"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="time"
                        value={row.start_time}
                        onChange={(e) => onChange(index, 'start_time', e.target.value)}
                        className="h-9 text-xs text-center rounded-xl border-gray-200 bg-gray-50/50"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="time"
                        value={row.stop_time}
                        onChange={(e) => onChange(index, 'stop_time', e.target.value)}
                        className="h-9 text-xs text-center rounded-xl border-gray-200 bg-gray-50/50"
                      />
                    </TableCell>

                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono font-bold tabular-nums ${
                          isRunning
                            ? 'text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-xs bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isRunning && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                        {!isRunning && <Clock className="h-3 w-3 text-gray-400" />}
                        {row.elapsed_time || '00:00'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row.remark}
                        onChange={(e) => onChange(index, 'remark', e.target.value)}
                        className="h-9 text-xs text-center rounded-xl border-gray-200 bg-gray-50/50"
                      />
                    </TableCell>

                    {onDeleteRow && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDeleteRow(index)}
                          className="h-7 w-7 rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#c62828] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
