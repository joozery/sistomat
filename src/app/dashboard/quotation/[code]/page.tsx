'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface Job {
  job_code: string
  drawing_name: string
  quantity: number
}

interface QuoteRow {
  job_code: string
  drawing_name: string
  quantity: number
  unit_price: number
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function formatThaiDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatMoney(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const LEVEL1_RE = /^J[A-Z]-\d{3,4}$/

export default function QuotationPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string
  const isLevel1 = LEVEL1_RE.test(code)

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<QuoteRow[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [quoteDate, setQuoteDate] = useState(todayISO())
  const [vatEnabled, setVatEnabled] = useState(true)
  const [vatRate, setVatRate] = useState(7)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const query = isLevel1 ? `level1=${encodeURIComponent(code)}` : `level2=${encodeURIComponent(code)}`
      const res = await fetch(`/api/jobs?${query}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      const jobs: Job[] = Array.isArray(json) ? json : (json.jobs ?? [])
      setRows(
        jobs.map((j) => ({
          job_code: j.job_code,
          drawing_name: j.drawing_name || '',
          quantity: j.quantity || 1,
          unit_price: 0,
        }))
      )
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [code, isLevel1])

  useEffect(() => { loadJobs() }, [loadJobs])

  function updateRow(idx: number, patch: Partial<QuoteRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function addBlankRow() {
    setRows((prev) => [...prev, { job_code: '', drawing_name: '', quantity: 1, unit_price: 0 }])
  }

  const subtotal = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const vatAmount = vatEnabled ? subtotal * (vatRate / 100) : 0
  const total = subtotal + vatAmount

  const b = '1px solid #666'
  const th: React.CSSProperties = { border: b, padding: '5px 6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', backgroundColor: '#e0e0e0' }
  const td: React.CSSProperties = { border: b, padding: '4px 6px', fontSize: '11px' }

  const pageStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '14mm 16mm',
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
      fontFamily: 'Arial, sans-serif',
    }}>
      <style>{`
        @media screen {
          .print-page {
            border: 1px solid #bbb;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            margin-bottom: 20px;
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
          .print-only { display: none; }
        }

        @media print {
          html, body, main, .SidebarInset {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          html, body { background: #fff !important; }
          #print-overlay {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
          }
          #toolbar { display: none !important; }
          #pages-wrap { padding: 0 !important; background: #fff !important; }
          .print-page { border: none !important; box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div id="toolbar">
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> กลับ
        </button>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#e0e0ff' }}>
          ใบเสนอราคา — JOB {code}
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

      <div id="pages-wrap">
        <div className="print-page" style={pageStyle}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #7B1A1A', paddingBottom: '10px', marginBottom: '14px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#7B1A1A', margin: 0 }}>ใบเสนอราคา</h1>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>QUOTATION</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px' }}>
              <p style={{ margin: 0 }}>เลขที่: <strong>QT-{code}</strong></p>
              <p style={{ margin: '2px 0 0' }}>
                วันที่:{' '}
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="no-print"
                  style={{ border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', padding: '1px 4px' }}
                />
                <span className="print-only">{formatThaiDate(quoteDate)}</span>
              </p>
            </div>
          </div>

          {/* Customer */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>เรียน / ลูกค้า:</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ชื่อลูกค้า / บริษัท"
              style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', padding: '5px 8px', marginBottom: '6px', boxSizing: 'border-box' }}
            />
            <input
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="ที่อยู่ / เลขผู้เสียภาษี (ถ้ามี)"
              style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', padding: '5px 8px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '32px' }}>ลำดับ</th>
                <th style={{ ...th, width: '110px' }}>JOB Code</th>
                <th style={th}>รายการ / ชื่อแบบ</th>
                <th style={{ ...th, width: '60px' }}>จำนวน</th>
                <th style={{ ...th, width: '90px' }}>ราคา/หน่วย</th>
                <th style={{ ...th, width: '100px' }}>รวม</th>
                <th style={{ ...th, width: '28px' }} className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '16px' }}>กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '16px', color: '#999' }}>ไม่พบรายการ — เพิ่มแถวเองได้</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{r.job_code || '-'}</td>
                    <td style={td}>
                      <input
                        value={r.drawing_name}
                        onChange={(e) => updateRow(i, { drawing_name: e.target.value })}
                        style={{ width: '100%', border: 'none', fontSize: '11px', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        value={r.quantity}
                        onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })}
                        style={{ width: '100%', border: 'none', textAlign: 'center', fontSize: '11px' }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.unit_price}
                        onChange={(e) => updateRow(i, { unit_price: Number(e.target.value) || 0 })}
                        style={{ width: '100%', border: 'none', textAlign: 'right', fontSize: '11px' }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(r.quantity * r.unit_price)}</td>
                    <td style={{ ...td, textAlign: 'center' }} className="no-print">
                      <button onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c00' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <button
            onClick={addBlankRow}
            className="no-print"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px dashed #999', background: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#666', cursor: 'pointer', marginBottom: '14px' }}
          >
            <Plus size={12} /> เพิ่มแถว
          </button>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ width: '260px', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 6px' }}>รวมเป็นเงิน</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{formatMoney(subtotal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 6px' }}>
                    <label className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} />
                      VAT
                    </label>
                    <span style={{ marginLeft: '4px' }}>
                      (
                      <input
                        type="number"
                        min={0}
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                        className="no-print"
                        style={{ width: '32px', border: 'none', borderBottom: '1px solid #ccc', textAlign: 'center', fontSize: '11px' }}
                      />
                      %)
                    </span>
                  </td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{vatEnabled ? formatMoney(vatAmount) : '-'}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold', fontSize: '13px' }}>
                  <td style={{ padding: '5px 6px' }}>ยอดรวมทั้งสิ้น</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: '#7B1A1A' }}>{formatMoney(total)} บาท</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', fontSize: '11px' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1px solid #999', paddingTop: '4px' }}>ผู้เสนอราคา</div>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1px solid #999', paddingTop: '4px' }}>ผู้อนุมัติ / ลูกค้า</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
