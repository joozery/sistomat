'use client'

import dynamic from 'next/dynamic'
import type { ProcessRow } from './ProcessTable'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

interface PrintJobSheetProps {
  jobId: string
  dwgName?: string
  receivedDate: string
  dueDate: string
  processList: ProcessRow[]
}

function splitProcesses(list: ProcessRow[]) {
  const padded = [...list]
  while (padded.length < 20) {
    padded.push({ id: 0, process: '', target_time: '', skill: '', workers: [], elapsed_time: '', remark: '' })
  }
  return { left: padded.slice(0, 10), right: padded.slice(10, 20) }
}

const QC_POINTS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P']

const border = '1px solid #666'

const th: React.CSSProperties = {
  border,
  padding: '2px 4px',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '9px',
  backgroundColor: '#e0e0e0',
}

const td: React.CSSProperties = {
  border,
  padding: '2px 4px',
  fontSize: '9px',
}

const tdC: React.CSSProperties = {
  border,
  padding: '2px 4px',
  fontSize: '9px',
  textAlign: 'center',
}

export function PrintJobSheet({ jobId, dwgName, receivedDate, dueDate, processList }: PrintJobSheetProps) {
  const { left, right } = splitProcesses(processList)

  const page: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '10mm 12mm',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    color: '#000',
    fontFamily: 'Arial, sans-serif',
  }

  return (
    <div
      id="print-area"
      style={{ display: 'none', backgroundColor: '#fff' }}
    >
      {/* ════════════════════════════════
          PAGE 1 — กระบวนการผลิต
      ════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: 'always' }}>

        {/* หัว */}
        <div style={{ border, backgroundColor: '#a5f3fc', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', padding: '4px 0', marginBottom: '5px' }}>
          สรุปกระบวนการผลิต
        </div>

        {/* JOB row */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: 'bold', whiteSpace: 'nowrap', width: '130px' }}>JOB {jobId}</td>
              <td style={{ ...tdC }}>
                <Barcode value={jobId} width={1.2} height={36} fontSize={0} displayValue={false} background="#fff" lineColor="#000" />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap', width: '100px' }}>วันรับงาน: <strong>{receivedDate}</strong></td>
              <td style={{ ...td, whiteSpace: 'nowrap', width: '100px' }}>กำหนดส่ง: <strong>{dueDate}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Section title */}
        <div style={{ border, backgroundColor: '#fde047', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', padding: '3px 0' }}>
          กระบวนการผลิต
        </div>

        {/* Process table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#a5f3fc' }}>
              <th style={{ ...th, width: '36px' }}>ลำดับที่</th>
              <th style={{ ...th, width: '90px' }}>กระบวนการ</th>
              <th style={{ ...th, width: '70px' }}>เป้าหมาย<br />(นาที)</th>
              <th style={{ ...th, width: '36px', borderLeft: '2px solid #333' }}>ลำดับที่</th>
              <th style={{ ...th, width: '90px' }}>กระบวนการ</th>
              <th style={{ ...th, width: '70px' }}>เป้าหมาย<br />(นาที)</th>
              <th style={{ ...th }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {left.map((rowL, i) => {
              const rowR = right[i]
              const isQcFnL = rowL.process === 'QC FN'
              const isQcFnR = rowR?.process === 'QC FN'
              const rowH = '18px'
              return (
                <tr key={i} style={{ height: rowH }}>
                  <td style={{ ...tdC, height: rowH }}>{rowL.process ? i + 1 : ''}</td>
                  <td style={{
                    ...td,
                    color: isQcFnL ? '#c62828' : '#000',
                    fontWeight: isQcFnL ? 'bold' : 'normal',
                    backgroundColor: isQcFnL ? '#fef08a' : '#fff',
                  }}>
                    {rowL.process}
                  </td>
                  <td style={{ ...tdC }}>{rowL.target_time}</td>

                  <td style={{ ...tdC, borderLeft: '2px solid #333' }}>{rowR?.process ? i + 11 : ''}</td>
                  <td style={{
                    ...td,
                    color: isQcFnR ? '#c62828' : '#000',
                    fontWeight: isQcFnR ? 'bold' : 'normal',
                    backgroundColor: isQcFnR ? '#fef08a' : '#fff',
                  }}>
                    {rowR?.process ?? ''}
                  </td>
                  <td style={{ ...tdC }}>{rowR?.target_time ?? ''}</td>
                  <td style={{ ...td }}></td>
                </tr>
              )
            })}
          </tbody>
        </table>


      </div>

      {/* ════════════════════════════════
          PAGE 2 — QC Inspection
      ════════════════════════════════ */}
      <div style={page}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>For QC Inspection</span>
          <span>JOB No.: <strong style={{ color: '#c62828' }}>{jobId}</strong></span>
          <span>Date: ___________________________</span>
        </div>

        {/* Inspection Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ ...th, backgroundColor: '#c0c0c0' }}>INSPECTION</th>
              <th colSpan={10} style={{ ...th, backgroundColor: '#c0c0c0' }}>No.</th>
              <th style={{ ...th, backgroundColor: '#c0c0c0', fontSize: '8px' }}>EQUIPMENT<br />SYMBOL</th>
            </tr>
            <tr>
              <th style={{ ...th, backgroundColor: '#d8d8d8', width: '32px' }}>POINT</th>
              <th style={{ ...th, backgroundColor: '#d8d8d8', minWidth: '80px' }}>SPEC</th>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <th key={n} style={{ ...th, backgroundColor: '#d8d8d8', width: '26px' }}>{n}</th>
              ))}
              <th style={{ ...th, backgroundColor: '#d8d8d8', width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {QC_POINTS.map((pt) => (
              <tr key={pt} style={{ height: '20px' }}>
                <td style={{ ...tdC, height: '20px' }}>{pt}</td>
                <td style={{ ...td }}></td>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <td key={n} style={{ ...tdC }}></td>
                ))}
                <td style={{ ...tdC }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '1px solid #555',
                    margin: '0 auto',
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Remark row */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
          <tbody>
            <tr>
              <td style={{ ...td, width: '80px', fontWeight: 'bold' }}>REMARK :</td>
              <td style={{ ...td }}></td>
              <td style={{ ...tdC, whiteSpace: 'nowrap', width: '180px', fontSize: '10px' }}>
                □ &nbsp;ACCEPT &nbsp;&nbsp;&nbsp; □ &nbsp;REJECT
              </td>
            </tr>
          </tbody>
        </table>

        {/* Equipment + Sign */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
          <tbody>
            <tr>
              <td style={{ ...td, verticalAlign: 'top', padding: '5px', width: '42%', fontSize: '9px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>EQUIPMENT SYMBOL</div>
                {['VERNIER CALIPER','MICRO METER','PIN GAUGE','VISUAL (APPEARANCE)','OTHER'].map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid #555', flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </td>
              <td style={{ ...td, textAlign: 'center', height: '70px', verticalAlign: 'bottom', padding: '4px', fontSize: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>INSPECTER / QC</div>
              </td>
              <td style={{ ...td, textAlign: 'center', height: '70px', verticalAlign: 'bottom', padding: '4px', fontSize: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>APPROVE</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
