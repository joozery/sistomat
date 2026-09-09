'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { useInspectors } from '@/lib/useInspectors'

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
  activePoints: string[]
  equipment: string[]
  result: 'accept' | 'reject' | ''
  remark: string
  inspector: string
  inspector_signature: string
  approver: string
  approver_signature: string
}

function emptyPointRow(): PointRow {
  return { spec: '', values: Array(VALUE_COLS).fill('') }
}

function emptyQcData(): QcData {
  const points: Record<string, PointRow> = {}
  for (const pt of QC_POINTS) points[pt] = emptyPointRow()
  return {
    date: '', points, activePoints: [...QC_POINTS], equipment: [], result: '', remark: '',
    inspector: '', inspector_signature: '', approver: '', approver_signature: '',
  }
}

function SignaturePickerPopover({
  inspectors,
  onPick,
  onClear,
  onClose,
}: {
  inspectors: { id: string; name: string; signature_url: string | null }[]
  onPick: (name: string) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <>
      <div className="no-print" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
      <div
        className="no-print"
        style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 201, marginTop: '4px', width: '180px',
          backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '6px',
        }}
      >
        {inspectors.length === 0 ? (
          <p style={{ fontSize: '10px', color: '#999', padding: '8px', textAlign: 'center' }}>
            ยังไม่มีลายเซ็น — ไปเพิ่มที่หน้าตั้งค่าระบบ
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '220px', overflowY: 'auto' }}>
            {inspectors.map((i) => (
              <button
                key={i.id}
                onClick={() => onPick(i.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px',
                  border: 'none', borderRadius: '6px', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'Arial, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ width: '48px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', border: '1px solid #eee', borderRadius: '4px', flexShrink: 0 }}>
                  {i.signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.signature_url} alt={i.name} style={{ maxHeight: '20px', maxWidth: '44px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '8px', color: '#ccc' }}>ไม่มีรูป</span>
                  )}
                </div>
                <span style={{ fontSize: '10px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ borderTop: '1px solid #eee', marginTop: '4px', paddingTop: '4px' }}>
          <button
            onClick={onClear}
            style={{
              width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '10px', color: '#c00', padding: '5px 6px', textAlign: 'center', fontFamily: 'Arial, sans-serif',
            }}
          >
            ล้างลายเซ็น
          </button>
        </div>
      </div>
    </>
  )
}

export default function QcSheetPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const { inspectors } = useInspectors()
  const [signaturePicker, setSignaturePicker] = useState<'inspector' | 'approver' | null>(null)

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
          activePoints: data.qc.activePoints ?? [...QC_POINTS],
        })
      }
    } catch {
      setFound(false)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ถ้ามีผู้ตรวจตั้งค่าไว้แค่คนเดียว ไม่ต้องให้กดเลือกเอง — ใส่ลายเซ็นให้อัตโนมัติ
  const autoFilledRef = useRef(false)
  useEffect(() => {
    if (loading || autoFilledRef.current || inspectors.length !== 1) return
    autoFilledRef.current = true
    const only = inspectors[0]
    setQc((prev) => ({
      ...prev,
      inspector: prev.inspector || only.name,
      inspector_signature: prev.inspector_signature || (only.signature_url ?? ''),
      approver: prev.approver || only.name,
      approver_signature: prev.approver_signature || (only.signature_url ?? ''),
    }))
  }, [loading, inspectors])

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

  function pickInspector(field: 'inspector' | 'approver', name: string) {
    const found = inspectors.find((i) => i.name === name)
    patchQc(
      field === 'inspector'
        ? { inspector: name, inspector_signature: found?.signature_url ?? '' }
        : { approver: name, approver_signature: found?.signature_url ?? '' }
    )
    setSignaturePicker(null)
  }

  function clearSignature(field: 'inspector' | 'approver') {
    patchQc(
      field === 'inspector'
        ? { inspector: '', inspector_signature: '' }
        : { approver: '', approver_signature: '' }
    )
    setSignaturePicker(null)
  }

  function addPoint() {
    const active = qc.activePoints
    const last = active[active.length - 1]
    const next = String.fromCharCode(last.charCodeAt(0) + 1)
    if (next > 'Z') return
    setQc((prev) => ({
      ...prev,
      activePoints: [...prev.activePoints, next],
      points: { ...prev.points, [next]: emptyPointRow() },
    }))
    setSaved(false)
  }

  function removePoint(pt: string) {
    if (QC_POINTS.includes(pt)) return // ลบ default A-P ไม่ได้
    setQc((prev) => {
      const { [pt]: _, ...rest } = prev.points
      return { ...prev, activePoints: prev.activePoints.filter((p) => p !== pt), points: rest }
    })
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

        .no-print { }
        @media print {
          .no-print { display: none !important; }
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
                <th style={th({ backgroundColor: '#d8d8d8', width: '115px' })}>SPEC</th>
                {Array.from({ length: VALUE_COLS }, (_, i) => i + 1).map((n) => (
                  <th key={n} style={th({ backgroundColor: '#d8d8d8', width: '40px' })}>{n}</th>
                ))}
                <th style={th({ backgroundColor: '#d8d8d8' })}></th>
              </tr>
            </thead>
            <tbody>
              {qc.activePoints.map((pt) => (
                <tr key={pt}>
                  <td style={tdc({ height: '24px' })}>{pt}</td>
                  <td style={td()}>
                    <input
                      value={qc.points[pt]?.spec ?? ''}
                      onChange={(e) => updatePoint(pt, { spec: e.target.value })}
                      style={{ ...cellInput, textAlign: 'left' }}
                    />
                  </td>
                  {(qc.points[pt]?.values ?? Array(VALUE_COLS).fill('')).map((v, colIdx) => (
                    <td key={colIdx} style={tdc()}>
                      <input
                        value={v}
                        onChange={(e) => updatePointValue(pt, colIdx, e.target.value)}
                        style={cellInput}
                      />
                    </td>
                  ))}
                  <td style={tdc()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #555', flexShrink: 0 }} />
                      {!QC_POINTS.includes(pt) && (
                        <button
                          className="no-print"
                          onClick={() => removePoint(pt)}
                          title="ลบแถวนี้"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '14px', lineHeight: 1, padding: 0 }}
                        >×</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {/* Add row button */}
              {qc.activePoints[qc.activePoints.length - 1] < 'Z' && (
                <tr className="no-print">
                  <td colSpan={13} style={{ border: '1px solid #ccc', borderTop: 'none', padding: '0' }}>
                    <button
                      onClick={addPoint}
                      style={{
                        display: 'block', width: '100%', background: '#f9f9f9',
                        border: 'none', borderTop: '1px dashed #ccc',
                        cursor: 'pointer', fontSize: '13px', color: '#888',
                        padding: '3px 0', fontWeight: 'bold',
                      }}
                      title={`เพิ่มแถว ${String.fromCharCode(qc.activePoints[qc.activePoints.length - 1].charCodeAt(0) + 1)}`}
                    >
                      + เพิ่มแถว {String.fromCharCode(qc.activePoints[qc.activePoints.length - 1].charCodeAt(0) + 1)}
                    </button>
                  </td>
                </tr>
              )}
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
                <td style={td({ textAlign: 'center', height: '150px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px', position: 'relative' })}>
                  <div
                    onClick={() => setSignaturePicker((p) => (p === 'inspector' ? null : 'inspector'))}
                    style={{ height: '95px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'pointer' }}
                    title="คลิกเพื่อเปลี่ยนลายเซ็น"
                  >
                    {qc.inspector_signature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qc.inspector_signature} alt="ลายเซ็นผู้ตรวจ" style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="no-print" style={{ fontSize: '9px', color: '#aaa', border: '1px dashed #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                        คลิกเลือกลายเซ็น
                      </span>
                    )}
                  </div>
                  <strong style={{ display: 'block', marginTop: '4px' }}>INSPECTER / QC</strong>

                  {signaturePicker === 'inspector' && (
                    <SignaturePickerPopover
                      inspectors={inspectors}
                      onPick={(name) => pickInspector('inspector', name)}
                      onClear={() => clearSignature('inspector')}
                      onClose={() => setSignaturePicker(null)}
                    />
                  )}
                </td>
                <td style={td({ textAlign: 'center', height: '150px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px', position: 'relative' })}>
                  <div
                    onClick={() => setSignaturePicker((p) => (p === 'approver' ? null : 'approver'))}
                    style={{ height: '95px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'pointer' }}
                    title="คลิกเพื่อเปลี่ยนลายเซ็น"
                  >
                    {qc.approver_signature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qc.approver_signature} alt="ลายเซ็นผู้อนุมัติ" style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="no-print" style={{ fontSize: '9px', color: '#aaa', border: '1px dashed #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                        คลิกเลือกลายเซ็น
                      </span>
                    )}
                  </div>
                  <strong style={{ display: 'block', marginTop: '4px' }}>APPROVE</strong>

                  {signaturePicker === 'approver' && (
                    <SignaturePickerPopover
                      inspectors={inspectors}
                      onPick={(name) => pickInspector('approver', name)}
                      onClear={() => clearSignature('approver')}
                      onClose={() => setSignaturePicker(null)}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
