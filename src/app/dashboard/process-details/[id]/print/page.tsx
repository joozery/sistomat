'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import type { ProcessRow } from '@/components/pages/process-details/ProcessTable'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })
const PdfPagePreview = dynamic(
  () => import('@/components/pages/process-details/PdfPagePreview').then((m) => m.PdfPagePreview),
  { ssr: false }
)

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function formatThaiDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function splitProcesses(list: ProcessRow[]) {
  const padded = [...list]
  while (padded.length < 20) {
    padded.push({ id: 0, process: '', target_time: '', skill: '', workers: [], elapsed_time: '', remark: '' })
  }
  return { left: padded.slice(0, 10), right: padded.slice(10, 20) }
}

function getToken2() {
  try { return localStorage.getItem('token') ?? '' } catch { return '' }
}

export default function PrintPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [processList, setProcessList] = useState<ProcessRow[]>([])
  const [drawingLandscape, setDrawingLandscape] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      
      if (!res.ok) {
        setProject(null)
        setLoading(false)
        return
      }

      const data = await res.json()
      setProject(data)
      if (Array.isArray(data.processes) && data.processes.length > 0) {
        setProcessList(data.processes.map((p: any, i: number) => ({
          id: i + 1,
          process: p.process ?? '',
          target_time: p.target_time ?? '',
          skill: p.skill ?? '',
          workers: Array.isArray(p.workers) ? p.workers : [
            { worker_id: '', start_time: '', stop_time: '' },
            { worker_id: '', start_time: '', stop_time: '' },
            { worker_id: '', start_time: '', stop_time: '' },
            { worker_id: '', start_time: '', stop_time: '' },
          ],
          elapsed_time: p.elapsed_time ?? '',
          remark: p.remark ?? '',
        })))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', fontFamily: 'Arial, sans-serif' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>กำลังโหลด...</span>
      </div>
    )
  }

  if (!project) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial' }}>ไม่พบข้อมูลใบงาน</div>
  }

  const jobId = project.project_id
  const receivedDate = formatThaiDate(project.received_date)
  const dueDate = formatThaiDate(project.due_date)
  const { left, right } = splitProcesses(processList)
  // Primary file may be 3D — fallback to PDF found in attachments
  const pdfAttachment = (project.attachments ?? []).find((a: { file_name: string }) => getExt(a.file_name) === 'pdf')
  const drawingPdfUrl = getExt(project.file_name ?? '') === 'pdf' ? project.file_url : (pdfAttachment?.file_url ?? null)
  const drawingIsPdf = !!drawingPdfUrl

  const b = '1px solid #666'
  const th = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: b, padding: '3px 5px', textAlign: 'center',
    fontWeight: 'bold', fontSize: '10px', backgroundColor: '#e0e0e0', ...extra,
  })
  const td = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: b, padding: '2px 5px', fontSize: '10px', ...extra,
  })
  const tdc = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: b, padding: '2px 5px', fontSize: '10px', textAlign: 'center', ...extra,
  })

  // Shared A4 page style (screen = boxed, print = full bleed)
  const pageStyle: React.CSSProperties = {
    width: '210mm',
    padding: '12mm 14mm',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    color: '#000',
    fontFamily: 'Arial, sans-serif',
    margin: '0 auto',
  }

  return (
    <div id="print-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: '#d1d5db',
      overflowY: 'auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* ── Print CSS ── */}
      <style>{`
        /* @page rules */
        @page { size: A4 portrait; margin: 0; }

        @media screen {
          .print-page {
            border: 1px solid #bbb;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            margin-bottom: 20px;
            width: 210mm;
            min-height: 297mm;
            background-color: #fff;
          }
          .print-page.drawing-print-page {
            min-height: 297mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          #toolbar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: #1a1a2e;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 24px;
            margin-bottom: 20px;
          }
          #pages-wrap { padding: 24px; }
        }

        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide sidebar and GlobalBarcodeScanner; keep only sidebar-inset */
          [data-slot="sidebar-wrapper"] > *:not([data-slot="sidebar-inset"]) {
            display: none !important;
          }
          /* Break flex, remove the min-h-svh that creates blank pages */
          [data-slot="sidebar-wrapper"] {
            display: block !important;
            min-height: 0 !important;
            height: auto !important;
          }

          /* Hide navbar */
          header { display: none !important; }

          /* Reset both <main> elements (sidebar-inset + inner main) */
          main {
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
            flex: none !important;
          }

          /* Lift fixed overlay into document flow */
          #print-overlay {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #toolbar { display: none !important; }
          #pages-wrap { padding: 0 !important; margin: 0 !important; background: #fff !important; }

          .print-page {
            width: 210mm !important;
            max-width: 210mm !important;
            height: 295mm !important;
            max-height: 295mm !important;
            min-height: 0 !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 10mm 12mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .print-page.drawing-print-page {
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div id="toolbar">
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> กลับ
        </button>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#e0e0ff' }}>
          ตัวอย่างก่อนปริ้น — JOB {jobId}
        </span>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: '#7B1A1A', color: '#fff', border: 'none',
            borderRadius: '20px', padding: '8px 20px',
            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          <Printer size={16} /> ปริ้นเลย
        </button>
      </div>

      {/* ── Pages ── */}
      <div id="pages-wrap">

        {/* ═══ PAGE 0 — แบบ Drawing (PDF) ═══ */}
        {drawingIsPdf && (
          <div
            className="print-page drawing-print-page"
            style={{
              ...pageStyle,
              padding: 0,
            }}
          >
            <PdfPagePreview fileUrl={drawingPdfUrl!} onOrientation={setDrawingLandscape} />
          </div>
        )}

        {/* ═══ PAGE 1 — กระบวนการผลิต ═══ */}
        <div className="print-page" style={pageStyle}>

          {/* Section header */}
          <div style={{ border: b, backgroundColor: '#a5f3fc', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', padding: '5px 0', marginBottom: '6px' }}>
            สรุปกระบวนการผลิต
          </div>

          {/* JOB info row */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px' }}>
            <tbody>
              <tr>
                <td style={td({ fontWeight: 'bold', whiteSpace: 'nowrap', width: '120px', fontSize: '11px' })}>JOB {jobId}</td>
                <td style={tdc()}>
                  <Barcode value={jobId} width={1.2} height={36} fontSize={0} displayValue={false} background="#fff" lineColor="#000" />
                </td>
                <td style={td({ whiteSpace: 'nowrap', width: '120px', fontSize: '10px' })}>
                  วันรับงาน: <strong>{receivedDate}</strong>
                </td>
                <td style={td({ whiteSpace: 'nowrap', width: '120px', fontSize: '10px' })}>
                  กำหนดส่ง: <strong>{dueDate}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Section title */}
          <div style={{ border: b, backgroundColor: '#fde047', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', padding: '3px 0' }}>
            กระบวนการผลิต
          </div>

          {/* Process table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#a5f3fc' }}>
                <th style={th({ width: '40px' })}>ลำดับที่</th>
                <th style={th({ width: '100px' })}>กระบวนการ</th>
                <th style={th({ width: '80px' })}>เป้าหมาย<br />(นาที)</th>
                <th style={th({ width: '40px', borderLeft: '2px solid #333' })}>ลำดับที่</th>
                <th style={th({ width: '100px' })}>กระบวนการ</th>
                <th style={th({ width: '80px' })}>เป้าหมาย<br />(นาที)</th>
                <th style={th()}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {left.map((rowL, i) => {
                const rowR = right[i]
                const isQcFnL = rowL.process === 'QC FN'
                const isQcFnR = rowR?.process === 'QC FN'
                return (
                  <tr key={i}>
                    <td style={tdc({ height: '24px' })}>{rowL.process ? i + 1 : '\u00A0'}</td>
                    <td style={td({ color: isQcFnL ? '#7B1A1A' : '#000', fontWeight: isQcFnL ? 'bold' : 'normal', backgroundColor: isQcFnL ? '#fef08a' : '#fff' })}>
                      {rowL.process || '\u00A0'}
                    </td>
                    <td style={tdc()}>{rowL.target_time || '\u00A0'}</td>

                    <td style={tdc({ borderLeft: '2px solid #333' })}>{rowR?.process ? i + 11 : '\u00A0'}</td>
                    <td style={td({ color: isQcFnR ? '#7B1A1A' : '#000', fontWeight: isQcFnR ? 'bold' : 'normal', backgroundColor: isQcFnR ? '#fef08a' : '#fff' })}>
                      {rowR?.process || '\u00A0'}
                    </td>
                    <td style={tdc()}>{rowR?.target_time || '\u00A0'}</td>
                    <td style={td()}>{'\u00A0'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
