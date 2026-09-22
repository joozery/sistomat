'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Save, Loader2, CheckCircle2, Copy, Check } from 'lucide-react'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

const QC_POINTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']
const EQUIPMENT_OPTIONS = [
  { symbol: 'V', label: 'VERNIER CALIPER' },
  { symbol: 'M', label: 'MICRO METER' },
  { symbol: 'P', label: 'PIN GAUGE' },
  { symbol: 'A', label: 'VISUAL (APPEARANCE)' },
  { symbol: 'O', label: 'OTHER' },
]
const VALUE_COLS = 10
// จำนวนแถวต่อ 1 หน้ากระดาษ A4 — พอดี A-Z (26 แถว) แล้วค่อยขึ้นหน้าใหม่ (AA, AB, ...)
// พร้อม header ซ้ำ ให้พิมพ์ออกมาเป็นแผ่นถัดไปได้จริง
const ROWS_PER_PAGE = 26

interface PointRow {
  spec: string
  values: string[]
  equipment_symbol: string
}

interface QcData {
  date: string
  points: Record<string, PointRow>
  activePoints: string[]
  result: 'accept' | 'reject' | ''
  remark: string
  inspector: string
  inspector_signature: string
  approver: string
  approver_signature: string
  textColors: Record<string, string>
}

function emptyPointRow(): PointRow {
  return { spec: '', values: Array(VALUE_COLS).fill(''), equipment_symbol: '' }
}

function emptyQcData(): QcData {
  const points: Record<string, PointRow> = {}
  for (const pt of QC_POINTS) points[pt] = emptyPointRow()
  return {
    date: '', points, activePoints: [...QC_POINTS], result: '', remark: '',
    inspector: '', inspector_signature: '', approver: '', approver_signature: '',
    textColors: {},
  }
}

export default function QcSheetPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [fixedSignatures, setFixedSignatures] = useState({ qc_signature_url: '', approve_signature_url: '' })

  const [loading, setLoading] = useState(true)
  const [found, setFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qc, setQc] = useState<QcData>(emptyQcData())
  const [selectedTextField, setSelectedTextField] = useState<{ key: string; label: string } | null>(null)
  const [copiedPlusMinus, setCopiedPlusMinus] = useState(false)

  const copyPlusMinus = async () => {
    try {
      await navigator.clipboard.writeText('±')
      setCopiedPlusMinus(true)
      setTimeout(() => setCopiedPlusMinus(false), 1500)
    } catch {
      // clipboard not available — ignore
    }
  }
  const lastSavedQcRef = useRef('')

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
      let nextQc = emptyQcData()
      if (data.qc) {
        const merged = emptyQcData()
        nextQc = {
          ...merged,
          ...data.qc,
          points: { ...merged.points, ...(data.qc.points ?? {}) },
          activePoints: data.qc.activePoints ?? [...QC_POINTS],
          textColors: data.qc.textColors ?? {},
        }
      }
      lastSavedQcRef.current = JSON.stringify(nextQc)
      setQc(nextQc)
    } catch {
      setFound(false)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    fetch('/api/settings/qc-signatures', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setFixedSignatures(data) })
      .catch(() => {})
  }, [])

  // Auto-save หลังผู้ใช้หยุดแก้ไขชั่วครู่ และยกเลิก request เก่าถ้ามีการแก้ต่อทันที
  useEffect(() => {
    if (loading || !found) return
    const serialized = JSON.stringify(qc)
    if (serialized === lastSavedQcRef.current) return

    setSaved(false)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ qc }),
          signal: controller.signal,
        })
        if (res.ok) {
          lastSavedQcRef.current = serialized
          setSaved(true)
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSaved(false)
      } finally {
        if (!controller.signal.aborted) setSaving(false)
      }
    }, 800)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [qc, loading, found, id])

  function updatePoint(pt: string, patch: Partial<PointRow>) {
    setQc((prev) => ({ ...prev, points: { ...prev.points, [pt]: { ...prev.points[pt], ...patch } } }))
    setSaved(false)
  }

  // กริดตาราง QC — เก็บ ref ของ input แต่ละช่องเทียบตำแหน่ง [แถว, คอลัมน์]
  // เพื่อให้กดลูกศรเลื่อนโฟกัสไปช่องข้างเคียงได้ (คอลัมน์: 0=SPEC, 1-10=ค่าที่วัด, 11=EQUIPMENT SYMBOL)
  const gridRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  function setGridRef(rowIdx: number, colIdx: number) {
    return (el: HTMLInputElement | null) => {
      const key = `${rowIdx}:${colIdx}`
      if (el) gridRefs.current.set(key, el)
      else gridRefs.current.delete(key)
    }
  }

  function focusGridCell(rowIdx: number, colIdx: number, caret?: 'start' | 'end' | number) {
    // ค้นหาช่อง input ผ่าน data-qc-cell ใน DOM ตรงๆ (ชัวร์ที่สุด ไม่หลุดตาม lifecycle ของ React)
    const el = document.querySelector<HTMLInputElement>(`input[data-qc-cell="${rowIdx}:${colIdx}"]`)
      ?? gridRefs.current.get(`${rowIdx}:${colIdx}`)
    if (el) {
      el.focus()
      if (caret !== undefined) {
        const position = caret === 'start' ? 0 : caret === 'end' ? el.value.length : Math.min(caret, el.value.length)
        el.setSelectionRange(position, position)
      }
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    return Boolean(el)
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return

    const input = e.currentTarget
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    if (e.key.startsWith('Arrow') && !e.shiftKey && start === end) {
      let moved = false
      if (e.key === 'ArrowLeft' && start === 0) {
        moved = colIdx > 0
          ? focusGridCell(rowIdx, colIdx - 1, 'end')
          : focusGridCell(rowIdx - 1, VALUE_COLS + 1, 'end')
      } else if (e.key === 'ArrowRight' && end === input.value.length) {
        moved = focusGridCell(rowIdx, colIdx + 1, 'start') || focusGridCell(rowIdx + 1, 0, 'start')
      } else if (e.key === 'ArrowUp') {
        moved = focusGridCell(rowIdx - 1, colIdx, start)
      } else if (e.key === 'ArrowDown') {
        moved = focusGridCell(rowIdx + 1, colIdx, start)
      }
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }

    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13
    const isTab = e.key === 'Tab' || e.code === 'Tab' || e.keyCode === 9

    if (isEnter) {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        focusGridCell(rowIdx - 1, colIdx)
      } else {
        focusGridCell(rowIdx + 1, colIdx)
      }
    } else if (isTab) {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        if (colIdx > 0) {
          focusGridCell(rowIdx, colIdx - 1)
        } else {
          focusGridCell(rowIdx - 1, VALUE_COLS + 1)
        }
      } else {
        const nextInRow = document.querySelector<HTMLInputElement>(`input[data-qc-cell="${rowIdx}:${colIdx + 1}"]`)
        if (nextInRow) {
          focusGridCell(rowIdx, colIdx + 1)
        } else {
          focusGridCell(rowIdx + 1, 0)
        }
      }
    }
  }

  function updatePointValue(pt: string, colIdx: number, v: string) {
    setQc((prev) => {
      const values = [...prev.points[pt].values]
      values[colIdx] = v
      return { ...prev, points: { ...prev.points, [pt]: { ...prev.points[pt], values } } }
    })
    setSaved(false)
  }

  function patchQc(patch: Partial<QcData>) {
    setQc((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  function setTextColor(color: string) {
    if (!selectedTextField) return
    setQc((prev) => ({
      ...prev,
      textColors: { ...prev.textColors, [selectedTextField.key]: color },
    }))
    setSaved(false)
  }

  function clearTextColor() {
    if (!selectedTextField) return
    setQc((prev) => {
      const colors = { ...prev.textColors }
      delete colors[selectedTextField.key]
      return { ...prev, textColors: colors }
    })
    setSaved(false)
  }

  // ป้ายชื่อแถวถัดไปแบบ spreadsheet — วิ่งได้ไม่จำกัด: A..Z แล้วต่อด้วย AA, AB, ..., AZ, BA, ...
  function nextPointLabel(label: string): string {
    const chars = label.split('')
    let i = chars.length - 1
    while (i >= 0) {
      if (chars[i] === 'Z') {
        chars[i] = 'A'
        i--
      } else {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
        return chars.join('')
      }
    }
    return 'A' + chars.join('')
  }

  function addPoint() {
    const active = qc.activePoints
    const last = active[active.length - 1]
    const next = nextPointLabel(last)
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

  function removeLastPoint() {
    const active = qc.activePoints
    const last = active[active.length - 1]
    if (QC_POINTS.includes(last)) return // เหลือแค่ A-P ลบต่อไม่ได้แล้ว
    removePoint(last)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ qc }),
      })
      if (res.ok) {
        lastSavedQcRef.current = JSON.stringify(qc)
        setSaved(true)
      }
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
    width: '100%', height: '24px', border: 'none', background: 'transparent', fontSize: '11px', textAlign: 'center', fontFamily: 'Arial, sans-serif', padding: '0 2px', boxSizing: 'border-box',
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

        .qc-grid-input {
          outline: none;
          transition: background-color 0.1s, box-shadow 0.1s;
        }
        .qc-grid-input:focus {
          background-color: #dbeafe !important;
          box-shadow: inset 0 0 0 2px #2563eb !important;
          border-radius: 2px;
        }

        .no-print { }
        @media print {
          .no-print { display: none !important; }
          .qc-grid-input:focus {
            background-color: transparent !important;
            box-shadow: none !important;
          }
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
          .print-page + .print-page {
            page-break-before: always;
            break-before: page;
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
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '7px', borderRight: '1px solid #4b5563', paddingRight: '10px' }}>
            <span style={{ fontSize: '11px', color: selectedTextField ? '#fff' : '#9ca3af', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedTextField ? `สี: ${selectedTextField.label}` : 'คลิกช่องข้อความก่อน'}
            </span>
            <input
              type="color"
              aria-label="เลือกสีข้อความ"
              title={selectedTextField ? `เลือกสีข้อความ ${selectedTextField.label}` : 'กรุณาคลิกช่องข้อความก่อน'}
              value={selectedTextField ? (qc.textColors[selectedTextField.key] ?? '#000000') : '#000000'}
              onChange={(e) => setTextColor(e.target.value)}
              disabled={!selectedTextField}
              style={{ width: '30px', height: '26px', padding: '1px', border: '1px solid #6b7280', borderRadius: '5px', background: '#fff', cursor: selectedTextField ? 'pointer' : 'not-allowed' }}
            />
            <button
              type="button"
              onClick={clearTextColor}
              disabled={!selectedTextField || !qc.textColors[selectedTextField.key]}
              style={{ border: 'none', background: 'transparent', color: '#d1d5db', fontSize: '10px', cursor: selectedTextField ? 'pointer' : 'not-allowed', padding: '3px' }}
            >
              คืนสีเดิม
            </button>
          </div>
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
        {Array.from({ length: Math.ceil(qc.activePoints.length / ROWS_PER_PAGE) }, (_, pageIdx) => {
          const baseRowIdx = pageIdx * ROWS_PER_PAGE
          const pagePoints = qc.activePoints.slice(baseRowIdx, baseRowIdx + ROWS_PER_PAGE)
          const isLastPage = baseRowIdx + ROWS_PER_PAGE >= qc.activePoints.length
          return (
        <div className="print-page" style={pageStyle} key={pageIdx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>For QC Inspection{pageIdx > 0 ? ` (ต่อหน้า ${pageIdx + 1})` : ''}</span>
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
                <th style={th({ backgroundColor: '#d8d8d8', width: '115px' })}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    SPEC
                    <button
                      type="button"
                      onClick={copyPlusMinus}
                      title="คลิกเพื่อคัดลอกสัญลักษณ์ ± ไปยังคลิปบอร์ด"
                      className="no-print"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '2px',
                        border: '1px solid #999', borderRadius: '3px', background: '#fff',
                        padding: '1px 4px', fontSize: '10px', fontWeight: 'bold', color: '#555', cursor: 'pointer',
                      }}
                    >
                      {copiedPlusMinus ? (
                        <Check size={10} color="#059669" />
                      ) : (
                        <>
                          <span>±</span>
                          <Copy size={9} />
                        </>
                      )}
                    </button>
                  </span>
                </th>
                {Array.from({ length: VALUE_COLS }, (_, i) => i + 1).map((n) => (
                  <th key={n} style={th({ backgroundColor: '#d8d8d8', width: '40px' })}>{n}</th>
                ))}
                <th style={th({ backgroundColor: '#d8d8d8' })}></th>
              </tr>
            </thead>
            <tbody>
              {pagePoints.map((pt, localIdx) => {
                const rowIdx = baseRowIdx + localIdx
                return (
                <tr key={pt}>
                  <td style={tdc({ height: '24px' })}>{pt}</td>
                  <td style={{ ...td(), padding: 0 }} onClick={() => focusGridCell(rowIdx, 0)}>
                    <input
                      ref={setGridRef(rowIdx, 0)}
                      data-qc-cell={`${rowIdx}:0`}
                      className="qc-grid-input"
                      onKeyDown={(e) => handleGridKeyDown(e, rowIdx, 0)}
                      value={qc.points[pt]?.spec ?? ''}
                      onChange={(e) => updatePoint(pt, { spec: e.target.value })}
                      onFocus={() => {
                        setSelectedTextField({ key: `spec:${pt}`, label: `SPEC ${pt}` })
                      }}
                      style={{ ...cellInput, textAlign: 'left', paddingLeft: '6px', color: qc.textColors[`spec:${pt}`] ?? '#000000' }}
                    />
                  </td>
                  {(qc.points[pt]?.values ?? Array(VALUE_COLS).fill('')).map((v, colIdx) => (
                    <td key={colIdx} style={{ ...tdc(), padding: 0 }} onClick={() => focusGridCell(rowIdx, colIdx + 1)}>
                      <input
                        ref={setGridRef(rowIdx, colIdx + 1)}
                        data-qc-cell={`${rowIdx}:${colIdx + 1}`}
                        className="qc-grid-input"
                        onKeyDown={(e) => handleGridKeyDown(e, rowIdx, colIdx + 1)}
                        value={v}
                        onChange={(e) => updatePointValue(pt, colIdx, e.target.value)}
                        onFocus={() => {
                          setSelectedTextField({ key: `value:${pt}:${colIdx}`, label: `${pt}-${colIdx + 1}` })
                        }}
                        style={{ ...cellInput, color: qc.textColors[`value:${pt}:${colIdx}`] ?? '#000000' }}
                      />
                    </td>
                  ))}
                  <td style={{ ...tdc({ position: 'relative' }), padding: 0 }} onClick={() => focusGridCell(rowIdx, VALUE_COLS + 1)}>
                    <input
                      ref={setGridRef(rowIdx, VALUE_COLS + 1)}
                      data-qc-cell={`${rowIdx}:${VALUE_COLS + 1}`}
                      className="qc-grid-input"
                      onKeyDown={(e) => handleGridKeyDown(e, rowIdx, VALUE_COLS + 1)}
                      value={qc.points[pt]?.equipment_symbol ?? ''}
                      onChange={(e) => updatePoint(pt, { equipment_symbol: e.target.value })}
                      onFocus={() => {
                        setSelectedTextField({ key: `equipment_symbol:${pt}`, label: `EQUIPMENT SYMBOL ${pt}` })
                      }}
                      style={{ ...cellInput, color: qc.textColors[`equipment_symbol:${pt}`] ?? '#000000' }}
                    />
                    {!QC_POINTS.includes(pt) && (
                      <button
                        className="no-print"
                        onClick={(e) => { e.stopPropagation(); removePoint(pt); }}
                        title="ลบแถวนี้"
                        style={{ position: 'absolute', top: 0, right: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '12px', lineHeight: 1, padding: 0, zIndex: 20 }}
                      >×</button>
                    )}
                  </td>
                </tr>
                )
              })}
              {isLastPage && (
              <tr className="no-print">
                <td colSpan={13} style={{ border: '1px solid #ccc', borderTop: 'none', padding: '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#f9f9f9', borderTop: '1px dashed #ccc', padding: '3px 0' }}>
                    <button
                      onClick={removeLastPoint}
                      disabled={QC_POINTS.includes(qc.activePoints[qc.activePoints.length - 1])}
                      title="ลบแถวล่าสุด"
                      style={{
                        width: '20px', height: '20px', borderRadius: '4px', border: '1px solid #ccc',
                        background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#888',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        opacity: QC_POINTS.includes(qc.activePoints[qc.activePoints.length - 1]) ? 0.35 : 1,
                      }}
                    >−</button>
                    <span style={{ fontSize: '11px', color: '#888', minWidth: '80px', textAlign: 'center' }}>
                      {qc.activePoints.length} แถว
                    </span>
                    <button
                      onClick={addPoint}
                      title={`เพิ่มแถว ${nextPointLabel(qc.activePoints[qc.activePoints.length - 1])}`}
                      style={{
                        width: '20px', height: '20px', borderRadius: '4px', border: '1px solid #ccc',
                        background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#888',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                    >+</button>
                  </div>
                </td>
              </tr>
              )}
            </tbody>
          </table>

          {isLastPage && (
          <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ width: '80px', fontWeight: 'bold' })}>REMARK :</td>
                <td style={td()}>
                  <input
                    value={qc.remark}
                    onChange={(e) => patchQc({ remark: e.target.value })}
                    onFocus={() => setSelectedTextField({ key: 'remark', label: 'REMARK' })}
                    style={{ ...cellInput, textAlign: 'left', color: qc.textColors.remark ?? '#000000' }}
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

          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginTop: '6px' }}>
            <tbody>
              <tr>
                <td style={td({ verticalAlign: 'top', padding: '6px', width: '40%', fontSize: '9px' })}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>EQUIPMENT SYMBOL</div>
                  {EQUIPMENT_OPTIONS.map(({ symbol, label }) => (
                    <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 'bold', width: '14px' }}>{symbol}</span>
                      {label}
                    </div>
                  ))}
                </td>
                <td style={td({ width: '30%', textAlign: 'center', height: '150px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px', position: 'relative' })}>
                  <div style={{ width: '100%', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px', boxSizing: 'border-box' }}>
                    {fixedSignatures.qc_signature_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fixedSignatures.qc_signature_url} alt="ลายเซ็น QC" style={{ display: 'block', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="no-print" style={{ fontSize: '9px', color: '#aaa' }}>ตั้งค่าลายเซ็น QC ในหน้าตั้งค่า</span>
                    )}
                  </div>
                  <strong style={{ display: 'block', marginTop: '4px' }}>INSPECTER / QC</strong>
                </td>
                <td style={td({ width: '30%', textAlign: 'center', height: '150px', verticalAlign: 'bottom', padding: '6px', fontSize: '10px', position: 'relative' })}>
                  <div style={{ width: '100%', height: '95px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px', boxSizing: 'border-box' }}>
                    {fixedSignatures.approve_signature_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fixedSignatures.approve_signature_url} alt="ลายเซ็น Approve" style={{ display: 'block', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="no-print" style={{ fontSize: '9px', color: '#aaa' }}>ตั้งค่าลายเซ็น Approve ในหน้าตั้งค่า</span>
                    )}
                  </div>
                  <strong style={{ display: 'block', marginTop: '4px' }}>APPROVE</strong>
                </td>
              </tr>
            </tbody>
          </table>
          </>
          )}
        </div>
          )
        })}
      </div>
    </div>
  )
}
