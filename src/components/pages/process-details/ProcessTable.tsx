'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Fragment } from 'react'

export const processOptions = [
  'MATERAIL', 'QC', 'CAM1', 'CNC1', 'ML', 'QC FN', 'เสร็จงาน',
  'CNC SPAR', 'CAM 1', 'CAM 2', 'CNC 1', 'CNC 2',
]

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
  workers: WorkerLog[]
  elapsed_time: string
  remark: string
}

interface ProcessTableProps {
  processList: ProcessRow[]
  onChange: (index: number, field: keyof ProcessRow, value: string) => void
  onWorkerChange: (rowIndex: number, workerIndex: number, field: keyof WorkerLog, value: string) => void
  activeRowIndex?: number | null
  onRowClick?: (index: number) => void
  onAddRow: () => void
  onDeleteRow?: (index: number) => void
}

const workerColors = [
  { header: '#bbf7d0', subHeader: '#dcfce7', cell: '#f0fdf4' },
  { header: '#bfdbfe', subHeader: '#dbeafe', cell: '#eff6ff' },
  { header: '#fef08a', subHeader: '#fef9c3', cell: '#fefce8' },
  { header: '#fbcfe8', subHeader: '#fce7f3', cell: '#fdf2f8' },
]

export function ProcessTable({ processList, activeRowIndex, onRowClick, onChange, onWorkerChange, onAddRow, onDeleteRow }: ProcessTableProps) {
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
              <th rowSpan={2} className="border border-slate-300 text-center font-bold text-slate-800 px-2 py-1.5 w-12">
                SKILL
              </th>

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

              // Visual styling for active row
              const rowClass = isActive 
                ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset shadow-inner' 
                : 'hover:bg-gray-50 transition-colors border-b border-gray-100'

              return (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick?.(index)}
                  className={`cursor-pointer ${rowClass}`}
                >
                  <td className={`border border-slate-200 text-center text-gray-500 font-medium px-2 py-1 ${isActive ? 'bg-blue-100' : 'bg-gray-50'}`}>
                    {index + 1}
                  </td>

                  {/* กระบวนการ */}
                  <td className={`border border-slate-300 p-0 relative ${isActive ? 'bg-blue-100' : ''}`}>
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

                  {/* SKILL */}
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

                  {/* Workers x4 */}
                  {row.workers?.map((worker, wIndex) => (
                    <Fragment key={wIndex}>
                      <td className="border border-slate-300 p-0" style={{ backgroundColor: isActive ? '#dbeafe' : workerColors[wIndex].cell }}>
                        <input
                          type="text"
                          value={worker.worker_id}
                          onChange={(e) => onWorkerChange(index, wIndex, 'worker_id', e.target.value)}
                          className="w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700"
                          style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                        />
                      </td>
                      <td className="border border-slate-300 p-0" style={{ backgroundColor: isActive ? '#dbeafe' : workerColors[wIndex].cell }}>
                        <input
                          type="text"
                          value={worker.start_time}
                          onChange={(e) => onWorkerChange(index, wIndex, 'start_time', e.target.value)}
                          placeholder="--:--"
                          className="w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700"
                          style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                        />
                      </td>
                      <td className="border border-slate-300 p-0" style={{ backgroundColor: isActive ? '#dbeafe' : workerColors[wIndex].cell }}>
                        <input
                          type="text"
                          value={worker.stop_time}
                          onChange={(e) => onWorkerChange(index, wIndex, 'stop_time', e.target.value)}
                          placeholder="--:--"
                          className="w-full h-9 text-center border-0 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 text-slate-700"
                          style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                        />
                      </td>
                    </Fragment>
                  ))}

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
