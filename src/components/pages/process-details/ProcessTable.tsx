'use client'

import { Plus, Trash2, ScanBarcode, CheckCircle2, PauseCircle } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { isRowCompleted } from '@/lib/workers'
import { useCurrentUser } from '@/lib/useCurrentUser'

function parseTimeParts(t: string): { date: string; time: string } | null {
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const [datePart, timePart] = t.split(' ')
    const [, mm, dd] = datePart.split('-')
    return { date: `${dd}/${mm}`, time: (timePart ?? '').slice(0, 5) }
  }
  return { date: '', time: t.slice(0, 5) }
}

function TimeCell({ value, bgColor, onClick, hint }: { value: string; bgColor: string; onClick?: () => void; hint?: { label: string; color: string } }) {
  const parts = useMemo(() => parseTimeParts(value), [value])
  return (
    <td
      className={`border border-slate-300 p-0 ${onClick ? 'cursor-pointer hover:brightness-95 active:brightness-90' : ''}`}
      style={{ backgroundColor: bgColor }}
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center h-9 leading-none">
        {parts ? (
          <>
            {parts.date && <span className="text-[9px] text-gray-400 font-medium">{parts.date}</span>}
            <span className="text-[11px] font-semibold text-slate-700">{parts.time}</span>
          </>
        ) : hint ? (
          <span className={`text-[11px] font-semibold ${hint.color}`}>{hint.label}</span>
        ) : (
          <span className="text-[11px] text-gray-300">--:--</span>
        )}
      </div>
    </td>
  )
}

export interface WorkerLog {
  worker_id: string
  start_time: string
  stop_time: string
}

export interface ProcessRow {
  id: number
  process: string
  target_time: string
  skill: string
  overtime_grace?: string
  workers: WorkerLog[]
  elapsed_time: string
  remark: string
  next_confirmed_at?: string
  on_hold?: boolean
}

interface ProcessTableProps {
  processList: ProcessRow[]
  processOptions: string[]
  onChange: (index: number, field: keyof ProcessRow, value: string) => void
  onWorkerChange: (rowIndex: number, workerIndex: number, field: keyof WorkerLog, value: string) => void
  activeRowIndex?: number | null
  activeWorkerSlot?: { row: number; col: number } | null
  onRowClick?: (index: number) => void
  onWorkerSlotActivate?: (row: number, col: number) => void
  onStartClick?: (row: number, col: number) => void
  onStopClick?: (row: number, col: number) => void
  onAddRow: () => void
  onDeleteRow?: (index: number) => void
}

const workerColors = [
  { header: '#bbf7d0', subHeader: '#dcfce7', cell: '#f0fdf4' },
  { header: '#bfdbfe', subHeader: '#dbeafe', cell: '#eff6ff' },
  { header: '#fef08a', subHeader: '#fef9c3', cell: '#fefce8' },
  { header: '#fbcfe8', subHeader: '#fce7f3', cell: '#fdf2f8' },
]

export function ProcessTable({ processList, processOptions, activeRowIndex, activeWorkerSlot, onRowClick, onWorkerSlotActivate, onStartClick, onStopClick, onChange, onWorkerChange, onAddRow, onDeleteRow }: ProcessTableProps) {
  const { role } = useCurrentUser()
  const canSeeSkill = role !== 'User'

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm font-sans overflow-hidden">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#fde047]">
        <div className="flex-1" />
        <h2 className="text-base font-bold text-gray-900 tracking-wide">กระบวนการผลิต</h2>
        <div className="flex-1 flex justify-end">
          <button
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 rounded-full h-8 bg-gray-900 hover:bg-gray-800 text-white px-4 text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>เพิ่มแถว</span>
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse" style={{ fontSize: '12px' }}>
          <thead>
            {/* Row 1 – group headers */}
            <tr style={{ backgroundColor: '#a5f3fc' }}>
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-10">
                ลำดับ
              </th>
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-[120px]">
                กระบวนการ
              </th>
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-16 leading-snug">
                เป้าหมาย<br />
                <span className="font-normal text-[10px]">(นาที)</span>
              </th>
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-amber-700 px-2 py-1.5 w-16 leading-snug" title="เลยเป้าหมายไปกี่นาทีถึงจะเป็น OVERTIME (ว่าง = ใช้ค่าเริ่มต้นของระบบ)">
                OVERTIME<br />
                <span className="font-normal text-[10px]">(นาที)</span>
              </th>
              {canSeeSkill && (
                <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-12">
                  SKILL
                </th>
              )}

              {workerColors.map((c, i) => (
                <th key={i} colSpan={3}
                  className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5"
                  style={{ backgroundColor: c.header }}
                >
                  พนักงานชุดที่ {i + 1}
                </th>
              ))}

              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-24 leading-snug">
                รวมเวลา<br />
                <span className="font-normal text-[10px]">(ชม.)</span>
              </th>
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 min-w-[100px]">
                หมายเหตุ
              </th>
              {onDeleteRow && (
                <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-10">
                  ลบ
                </th>
              )}
            </tr>

            {/* Row 2 – sub-column headers */}
            <tr>
              {workerColors.map((c, i) => (
                <Fragment key={i}>
                  <th className="border border-slate-300 text-center font-semibold text-slate-700 px-1 py-1 w-[70px] text-[10px]"
                    style={{ backgroundColor: c.subHeader }}>
                    รหัสพนักงาน
                  </th>
                  <th className="border border-slate-300 text-center font-semibold text-slate-700 px-1 py-1 w-[60px] text-[10px]"
                    style={{ backgroundColor: c.subHeader }}>
                    เริ่ม
                  </th>
                  <th className="border border-slate-300 text-center font-semibold text-slate-700 px-1 py-1 w-[60px] text-[10px]"
                    style={{ backgroundColor: c.subHeader }}>
                    หยุด
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {processList.map((row, index) => {
              const isQcFn = row.process === 'QC FN'
              const isCompleted = row.process === 'เสร็จงาน'
              const isActive = activeRowIndex === index
              const isRunning = row.workers?.some(w => w.start_time && !w.stop_time)
              const isDone = isRowCompleted(row)
              const isOnHold = !isDone && !!row.on_hold

              // Visual styling for active row
              const rowClass = isActive
                ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset shadow-inner'
                : isDone
                  ? 'bg-emerald-50/60 border-b border-emerald-100/80'
                  : isOnHold
                    ? 'bg-amber-50/80 border-b border-amber-200'
                    : 'hover:bg-gray-50 transition-colors border-b border-gray-100'

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(index)}
                  className={`cursor-pointer ${rowClass}`}
                >
                  <td className={`border border-slate-200 text-center font-medium px-2 py-1 ${isActive ? 'bg-blue-100 text-gray-500' : isDone ? 'bg-emerald-100/60 text-emerald-600' : isOnHold ? 'bg-amber-100/80 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>
                    {isDone
                      ? <CheckCircle2 className="h-3.5 w-3.5 mx-auto text-emerald-500" />
                      : isOnHold
                        ? <PauseCircle className="h-3.5 w-3.5 mx-auto text-amber-500" />
                        : index + 1
                    }
                  </td>

                  {/* กระบวนการ */}
                  <td className={`border border-slate-300 p-0 relative ${isActive ? 'bg-blue-100' : isDone ? 'bg-emerald-50/40' : ''}`}>
                    <select
                      value={row.process}
                      onChange={(e) => onChange(index, 'process', e.target.value)}
                      className={`w-full h-9 border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 px-2 pr-6 text-slate-700 font-medium cursor-pointer appearance-none ${isActive ? 'bg-blue-100' : 'bg-white'}`}
                      style={{ fontSize: '12px' }}
                    >
                      {processOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </td>

                  {/* เป้าหมาย */}
                  <td className={`border border-slate-300 p-0 ${isActive ? 'bg-blue-100' : ''}`}>
                    <input
                      type="text"
                      value={row.target_time}
                      onChange={(e) => onChange(index, 'target_time', e.target.value)}
                      placeholder="00:00"
                      className={`w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700 ${isActive ? 'bg-blue-100' : 'bg-white'}`}
                      style={{ fontSize: '12px' }}
                    />
                  </td>

                  {/* OVERTIME grace (นาทีหลังเลยเป้าหมาย) */}
                  <td className={`border border-slate-300 p-0 ${isActive ? 'bg-blue-100' : ''}`}>
                    <input
                      type="text"
                      value={row.overtime_grace ?? ''}
                      onChange={(e) => onChange(index, 'overtime_grace', e.target.value)}
                      placeholder="ค่าเริ่มต้น"
                      className={`w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400 text-amber-700 placeholder:text-gray-300 placeholder:text-[10px] ${isActive ? 'bg-blue-100' : 'bg-white'}`}
                      style={{ fontSize: '12px' }}
                    />
                  </td>

                  {/* SKILL */}
                  {canSeeSkill && (
                    <td className={`border border-slate-300 p-0 ${isActive ? 'bg-blue-100' : ''}`}>
                      <input
                        type="text"
                        value={row.skill}
                        onChange={(e) => onChange(index, 'skill', e.target.value)}
                        placeholder="0"
                        className={`w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700 ${isActive ? 'bg-blue-100' : 'bg-white'}`}
                        style={{ fontSize: '12px' }}
                      />
                    </td>
                  )}

                  {/* Workers x4 */}
                  {row.workers?.map((worker, wIndex) => {
                    const isSlotActive = activeWorkerSlot?.row === index && activeWorkerSlot?.col === wIndex
                    return (
                    <Fragment key={wIndex}>
                      <td
                        className={`border p-0 relative ${isSlotActive ? 'border-amber-400 ring-2 ring-inset ring-amber-400' : 'border-slate-300'}`}
                        style={{ backgroundColor: isSlotActive ? '#fffbeb' : isActive ? '#dbeafe' : workerColors[wIndex].cell }}
                      >
                        {isSlotActive ? (
                          <button
                            className="w-full h-9 flex items-center justify-center gap-1 text-amber-600 font-semibold animate-pulse"
                            style={{ fontSize: '11px', backgroundColor: 'transparent', border: 'none', cursor: 'default' }}
                            onClick={(e) => { e.stopPropagation(); onWorkerSlotActivate?.(index, wIndex) }}
                          >
                            <ScanBarcode className="h-3.5 w-3.5" />
                            สแกน...
                          </button>
                        ) : (
                          <input
                            type="text"
                            value={worker.worker_id}
                            onChange={(e) => onWorkerChange(index, wIndex, 'worker_id', e.target.value)}
                            onFocus={(e) => {
                              e.target.blur()
                              onWorkerSlotActivate?.(index, wIndex)
                            }}
                            className="w-full h-9 text-center border-0 outline-none text-slate-700 cursor-pointer"
                            style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                            readOnly
                          />
                        )}
                      </td>
                      <TimeCell
                        value={worker.start_time}
                        bgColor={isActive ? '#dbeafe' : workerColors[wIndex].cell}
                        onClick={!worker.start_time ? () => onStartClick?.(index, wIndex) : undefined}
                        hint={!worker.start_time ? { label: '+ เริ่ม', color: 'text-emerald-400' } : undefined}
                      />
                      <TimeCell
                        value={worker.stop_time}
                        bgColor={isActive ? '#dbeafe' : workerColors[wIndex].cell}
                        onClick={worker.start_time && !worker.stop_time ? () => onStopClick?.(index, wIndex) : undefined}
                        hint={worker.start_time && !worker.stop_time ? { label: '+ หยุด', color: 'text-red-400' } : undefined}
                      />
                    </Fragment>
                  )
                  })}

                  {/* รวมเวลา */}
                  <td 
                    className="border border-slate-300 text-center font-bold px-2"
                    style={{ 
                      backgroundColor: isActive ? '#dbeafe' : (isRunning ? '#f0fdf4' : 'white'),
                      color: isRunning ? '#059669' : '#334155'
                    }}
                  >
                    {row.elapsed_time || '--:--:--'}
                  </td>

                  {/* หมายเหตุ */}
                  <td className="border border-slate-300 p-0">
                    <input
                      type="text"
                      value={row.remark}
                      onChange={(e) => onChange(index, 'remark', e.target.value)}
                      className="w-full h-9 bg-white border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700 px-2"
                      style={{ fontSize: '12px' }}
                    />
                  </td>

                  {/* ลบ */}
                  {onDeleteRow && (
                    <td className="border border-slate-300 p-0 text-center">
                      <button
                        onClick={() => onDeleteRow(index)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors mx-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
