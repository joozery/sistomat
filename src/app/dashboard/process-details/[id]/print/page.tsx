'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import type { ProcessRow } from '@/components/pages/process-details/ProcessTable'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
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

const QC_POINTS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P']

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
      {/* ── Print CSS (injected into <head> via style tag) ── */}
      <style>{`
        @media screen {
          .print-page {
            border: 1px solid #bbb;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            margin-bottom: 20px;
            min-height: 297mm;
            background-color: #fff;
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
          /* Reset Next.js layout containers so they don't clip content */
          html, body, main, .SidebarInset {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          html, body { 
            background: #fff !important; 
          }
          #print-overlay {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
          }
          #toolbar { display: none !important; }
          #pages-wrap { padding: 0 !important; background: #fff !important; }
          .print-page {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .print-page:last-child { page-break-after: auto; }
          @page { size: A4 portrait; margin: 0; }
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
            backgroundColor: '#c62828', color: '#fff', border: 'none',
            borderRadius: '20px', padding: '8px 20px',
            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          <Printer size={16} /> ปริ้นเลย
        </button>
      </div>

      {/* ── Pages ── */}
      <div id="pages-wrap">

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
                    <td style={td({ color: isQcFnL ? '#c62828' : '#000', fontWeight: isQcFnL ? 'bold' : 'normal', backgroundColor: isQcFnL ? '#fef08a' : '#fff' })}>
                      {rowL.process || '\u00A0'}
                    </td>
                    <td style={tdc()}>{rowL.target_time || '\u00A0'}</td>

                    <td style={tdc({ borderLeft: '2px solid #333' })}>{rowR?.process ? i + 11 : '\u00A0'}</td>
                    <td style={td({ color: isQcFnR ? '#c62828' : '#000', fontWeight: isQcFnR ? 'bold' : 'normal', backgroundColor: isQcFnR ? '#fef08a' : '#fff' })}>
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

        {/* ═══ PAGE 2 — QC Inspection ═══ */}
        <div className="print-page" style={pageStyle}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>For QC Inspection</span>
            <span>JOB No.: <strong style={{ color: '#c62828' }}>{jobId}</strong></span>
            <span>Date: ___________________________</span>
          </div>

          {/* Inspection table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th colSpan={2} style={th({ backgroundColor: '#c0c0c0', fontSize: '10px' })}>INSPECTION</th>
                <th colSpan={10} style={th({ backgroundColor: '#c0c0c0', fontSize: '10px' })}>No.</th>
                <th style={th({ backgroundColor: '#c0c0c0', fontSize: '9px', width: '44px' })}>EQUIPMENT<br />SYMBOL</th>
              </tr>
              <tr>
                <th style={th({ backgroundColor: '#d8d8d8', width: '36px' })}>POINT</th>
                <th style={th({ backgroundColor: '#d8d8d8', minWidth: '100px' })}>SPEC</th>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <th key={n} style={th({ backgroundColor: '#d8d8d8', width: '30px' })}>{n}</th>
                ))}
                <th style={th({ backgroundColor: '#d8d8d8' })}></th>
              </tr>
            </thead>
            <tbody>
              {QC_POINTS.map((pt) => (
                <tr key={pt}>
                  <td style={tdc({ height: '24px' })}>{pt}</td>
                  <td style={td()}>{'\u00A0'}</td>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <td key={n} style={tdc()}>{'\u00A0'}</td>
                  ))}
                  <td style={tdc()}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #555', margin: '0 auto' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Remark */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ width: '80px', fontWeight: 'bold' })}>REMARK :</td>
                <td style={td()}></td>
                <td style={tdc({ whiteSpace: 'nowrap', width: '200px', fontSize: '11px' })}>
                  □ &nbsp;ACCEPT &nbsp;&nbsp;&nbsp; □ &nbsp;REJECT
                </td>
              </tr>
            </tbody>
          </table>

          {/* Equipment + Signature */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ verticalAlign: 'top', padding: '6px', width: '40%', fontSize: '9px' })}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>EQUIPMENT SYMBOL</div>
                  {['VERNIER CALIPER','MICRO METER','PIN GAUGE','VISUAL (APPEARANCE)','OTHER'].map((label, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #555', flexShrink: 0 }} />
                      {label}
                    </div>
                  ))}
                </td>
                <td style={td({ textAlign: 'center', height: '80px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px' })}>
                  <strong>INSPECTER / QC</strong>
                </td>
                <td style={td({ textAlign: 'center', height: '80px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px' })}>
                  <strong>APPROVE</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
