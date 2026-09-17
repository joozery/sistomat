'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ProcessRow } from './ProcessTable'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })
const PdfPagePreview = dynamic(() => import('./PdfPagePreview').then((m) => m.PdfPagePreview), { ssr: false })

interface Attachment { file_url: string; file_name: string }
interface PrintJobSheetProps {
  jobId: string
  dwgName?: string
  receivedDate: string
  dueDate: string
  processList: ProcessRow[]
  fileUrl?: string
  fileName?: string
  attachments?: Attachment[] | null
}

function getExt(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

function splitProcesses(list: ProcessRow[]) {
  const padded = [...list]
  while (padded.length < 20) padded.push({ id: 0, process: '', target_time: '', skill: '', workers: [], elapsed_time: '', remark: '' })
  return { left: padded.slice(0, 10), right: padded.slice(10, 20) }
}

export function PrintJobSheet({ jobId, receivedDate, dueDate, processList, fileUrl, fileName, attachments = [] }: PrintJobSheetProps) {
  const [drawingLandscape, setDrawingLandscape] = useState(false)
  const { left, right } = useMemo(() => splitProcesses(processList), [processList])
  const safeAttachments = Array.isArray(attachments) ? attachments : []
  const pdfAttachment = safeAttachments.find((a) => getExt(a.file_name) === 'pdf')
  const drawingPdfUrl = getExt(fileName ?? '') === 'pdf' ? fileUrl : pdfAttachment?.file_url
  const border = '1px solid #666'
  const pageStyle: React.CSSProperties = {
    width: '210mm', minHeight: '297mm', padding: '12mm 14mm', boxSizing: 'border-box',
    backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif',
    pageBreakAfter: 'always', breakAfter: 'page',
  }
  const th = (extra?: React.CSSProperties): React.CSSProperties => ({ border, padding: '3px 5px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', backgroundColor: '#e0e0e0', ...extra })
  const td = (extra?: React.CSSProperties): React.CSSProperties => ({ border, padding: '2px 5px', fontSize: '10px', ...extra })
  const tdc = (extra?: React.CSSProperties): React.CSSProperties => ({ border, padding: '2px 5px', fontSize: '10px', textAlign: 'center', ...extra })

  return (
    <div id="print-area" style={{ display: 'none', backgroundColor: '#fff' }}>
      {drawingPdfUrl && (
        <div className="print-page drawing-print-page" style={{ ...pageStyle, padding: 0, width: drawingLandscape ? '297mm' : '210mm', minHeight: drawingLandscape ? '210mm' : '297mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PdfPagePreview fileUrl={drawingPdfUrl} onOrientation={setDrawingLandscape} />
        </div>
      )}

      <div className="print-page" style={pageStyle}>
        <div style={{ border, backgroundColor: '#a5f3fc', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', padding: '5px 0', marginBottom: '6px' }}>
          สรุปกระบวนการผลิต
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px' }}>
          <tbody><tr>
            <td style={td({ fontWeight: 'bold', whiteSpace: 'nowrap', width: '120px', fontSize: '11px' })}>JOB {jobId}</td>
            <td style={tdc()}><Barcode value={jobId} width={1.2} height={36} fontSize={0} displayValue={false} background="#fff" lineColor="#000" /></td>
            <td style={td({ whiteSpace: 'nowrap', width: '120px' })}>วันรับงาน: <strong>{receivedDate}</strong></td>
            <td style={td({ whiteSpace: 'nowrap', width: '120px' })}>กำหนดส่ง: <strong>{dueDate}</strong></td>
          </tr></tbody>
        </table>
        <div style={{ border, backgroundColor: '#fde047', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', padding: '3px 0' }}>กระบวนการผลิต</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ backgroundColor: '#a5f3fc' }}>
            <th style={th({ width: '40px' })}>ลำดับที่</th><th style={th({ width: '100px' })}>กระบวนการ</th>
            <th style={th({ width: '40px', borderLeft: '2px solid #333' })}>ลำดับที่</th><th style={th({ width: '100px' })}>กระบวนการ</th><th style={th()}>หมายเหตุ</th>
          </tr></thead>
          <tbody>
            {left.map((rowL, i) => {
              const rowR = right[i]
              const isQcFnL = rowL.process === 'QC FN'; const isQcFnR = rowR?.process === 'QC FN'
              return <tr key={i}>
                <td style={tdc({ height: '24px' })}>{rowL.process ? i + 1 : '\u00A0'}</td>
                <td style={td({ color: isQcFnL ? '#7B1A1A' : '#000', fontWeight: isQcFnL ? 'bold' : 'normal', backgroundColor: isQcFnL ? '#fef08a' : '#fff' })}>{rowL.process || '\u00A0'}</td>
                <td style={tdc({ borderLeft: '2px solid #333' })}>{rowR?.process ? i + 11 : '\u00A0'}</td>
                <td style={td({ color: isQcFnR ? '#7B1A1A' : '#000', fontWeight: isQcFnR ? 'bold' : 'normal', backgroundColor: isQcFnR ? '#fef08a' : '#fff' })}>{rowR?.process || '\u00A0'}</td>
                <td style={td()}>{'\u00A0'}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
