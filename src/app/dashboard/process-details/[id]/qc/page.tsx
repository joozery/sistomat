'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Save, Loader2, CheckCircle2 } from 'lucide-react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

const QC_POINTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']
const EQUIPMENT_OPTIONS = ['VERNIER CALIPER', 'MICRO METER', 'PIN GAUGE', 'VISUAL (APPEARANCE)', 'OTHER']
const VALUE_COLS = 10

interface PointRow {
  spec: string
  values: string[]
}

interface QcData {
  date: string
  points: Record<string, PointRow>
  equipment: string[]
  result: 'accept' | 'reject' | ''
  remark: string
  inspector: string
  approver: string
}

function emptyPointRow(): PointRow {
  return { spec: '', values: Array(VALUE_COLS).fill('') }
}

function emptyQcData(): QcData {
  const points: Record<string, PointRow> = {}
  for (const pt of QC_POINTS) points[pt] = emptyPointRow()
  return { date: '', points, equipment: [], result: '', remark: '', inspector: '', approver: '' }
}

export default function QcSheetPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [found, setFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qc, setQc] = useState<QcData>(emptyQcData())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        setFound(false)
        return
      }
      const data = await res.json()
      setFound(true)
      if (data.qc) {
        const merged = emptyQcData()
        setQc({
          ...merged,
          ...data.qc,
          points: { ...merged.points, ...(data.qc.points ?? {}) },
        })
      }
    } catch {
      setFound(false)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  function updatePoint(pt: string, patch: Partial<PointRow>) {
    setQc((prev) => ({ ...prev, points: { ...prev.points, [pt]: { ...prev.points[pt], ...patch } } }))
    setSaved(false)
  }

  function updatePointValue(pt: string, colIdx: number, v: string) {
    setQc((prev) => {
      const values = [...prev.points[pt].values]
      values[colIdx] = v
      return { ...prev, points: { ...prev.points, [pt]: { ...prev.points[pt], values } } }
    })
    setSaved(false)
  }

  function toggleEquipment(label: string) {
    setQc((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(label)
        ? prev.equipment.filter((e) => e !== label)
        : [...prev.equipment, label],
    }))
    setSaved(false)
  }

  function patchQc(patch: Partial<QcData>) {
    setQc((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ qc }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', fontFamily: 'Arial, sans-serif' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>กำลังโหลด...</span>
      </div>
    )
  }

  if (!found) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial' }}>ไม่พบข้อมูลใบงาน</div>
  }

  const jobId = id

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
  const cellInput: React.CSSProperties = {
    width: '100%', border: 'none', background: 'transparent', fontSize: '10px', textAlign: 'center', fontFamily: 'Arial, sans-serif',
  }

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
          }
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
          ใบกรอก QC — JOB {jobId}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4ade80' }}>
              <CheckCircle2 size={14} /> บันทึกแล้ว
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '20px', padding: '8px 20px',
              fontSize: '13px', fontWeight: 'bold', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
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
      </div>

      <div id="pages-wrap">
        <div className="print-page" style={pageStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>For QC Inspection</span>
            <span>JOB No.: <strong style={{ color: '#7B1A1A' }}>{jobId}</strong></span>
            <span>
              Date:{' '}
              <input
                type="date"
                value={qc.date}
                onChange={(e) => patchQc({ date: e.target.value })}
                style={{ border: 'none', borderBottom: '1px solid #999', fontSize: '11px' }}
              />
            </span>
          </div>

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
                {Array.from({ length: VALUE_COLS }, (_, i) => i + 1).map((n) => (
                  <th key={n} style={th({ backgroundColor: '#d8d8d8', width: '30px' })}>{n}</th>
                ))}
                <th style={th({ backgroundColor: '#d8d8d8' })}></th>
              </tr>
            </thead>
            <tbody>
              {QC_POINTS.map((pt) => (
                <tr key={pt}>
                  <td style={tdc({ height: '24px' })}>{pt}</td>
                  <td style={td()}>
                    <input
                      value={qc.points[pt].spec}
                      onChange={(e) => updatePoint(pt, { spec: e.target.value })}
                      style={{ ...cellInput, textAlign: 'left' }}
                    />
                  </td>
                  {qc.points[pt].values.map((v, colIdx) => (
                    <td key={colIdx} style={tdc()}>
                      <input
                        value={v}
                        onChange={(e) => updatePointValue(pt, colIdx, e.target.value)}
                        style={cellInput}
                      />
                    </td>
                  ))}
                  <td style={tdc()}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #555', margin: '0 auto' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ width: '80px', fontWeight: 'bold' })}>REMARK :</td>
                <td style={td()}>
                  <input
                    value={qc.remark}
                    onChange={(e) => patchQc({ remark: e.target.value })}
                    style={{ ...cellInput, textAlign: 'left' }}
                  />
                </td>
                <td style={tdc({ whiteSpace: 'nowrap', width: '220px', fontSize: '11px' })}>
                  <label style={{ marginRight: '10px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="qc-result"
                      checked={qc.result === 'accept'}
                      onChange={() => patchQc({ result: 'accept' })}
                      style={{ marginRight: '4px' }}
                    />
                    ACCEPT
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="qc-result"
                      checked={qc.result === 'reject'}
                      onChange={() => patchQc({ result: 'reject' })}
                      style={{ marginRight: '4px' }}
                    />
                    REJECT
                  </label>
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ verticalAlign: 'top', padding: '6px', width: '40%', fontSize: '9px' })}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>EQUIPMENT SYMBOL</div>
                  {EQUIPMENT_OPTIONS.map((label) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={qc.equipment.includes(label)}
                        onChange={() => toggleEquipment(label)}
                      />
                      {label}
                    </label>
                  ))}
                </td>
                <td style={td({ textAlign: 'center', height: '80px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px' })}>
                  <strong>INSPECTER / QC</strong>
                  <input
                    value={qc.inspector}
                    onChange={(e) => patchQc({ inspector: e.target.value })}
                    placeholder="ชื่อผู้ตรวจ"
                    style={{ ...cellInput, textAlign: 'center', borderBottom: '1px solid #999', marginTop: '6px' }}
                  />
                </td>
                <td style={td({ textAlign: 'center', height: '80px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px' })}>
                  <strong>APPROVE</strong>
                  <input
                    value={qc.approver}
                    onChange={(e) => patchQc({ approver: e.target.value })}
                    placeholder="ชื่อผู้อนุมัติ"
                    style={{ ...cellInput, textAlign: 'center', borderBottom: '1px solid #999', marginTop: '6px' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
