'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react'

interface Job {
  job_code: string
  drawing_name: string
  quantity: number
  material?: string
  coating?: string
}

interface QuoteRow {
  job_code: string
  drawing_name: string
  material: string
  unit: string
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

function formatShortThaiDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const day = d.getDate()
    const month = months[d.getMonth()]
    const year = String(d.getFullYear() + 543).slice(-2)
    return `${day}-${month}-${year}`
  } catch {
    return dateStr
  }
}

function formatMoney(n: number) {
  if (n === 0) return '-'
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function bahtText(num: number): string {
  if (isNaN(num) || num <= 0) return '(ศูนย์บาทถ้วน)'
  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']

  const fixed = num.toFixed(2)
  const [integerStr, decimalStr] = fixed.split('.')

  function convertGroup(groupStr: string): string {
    let res = ''
    const len = groupStr.length
    for (let i = 0; i < len; i++) {
      const digit = parseInt(groupStr[i], 10)
      const pos = len - i - 1
      if (digit !== 0) {
        if (pos === 1 && digit === 1) res += 'สิบ'
        else if (pos === 1 && digit === 2) res += 'ยี่สิบ'
        else if (pos === 0 && digit === 1 && len > 1) res += 'เอ็ด'
        else res += numbers[digit] + units[pos]
      }
    }
    return res
  }

  let bahtStr = ''
  let intStr = integerStr
  if (intStr.length > 6) {
    const millionPart = intStr.slice(0, intStr.length - 6)
    intStr = intStr.slice(intStr.length - 6)
    bahtStr += convertGroup(millionPart) + 'ล้าน'
  }
  bahtStr += convertGroup(intStr)

  if (!bahtStr) bahtStr = 'ศูนย์'
  bahtStr += 'บาท'

  if (!decimalStr || decimalStr === '00') {
    bahtStr += 'ถ้วน'
  } else {
    const satangStr = convertGroup(decimalStr)
    bahtStr += satangStr + 'สตางค์'
  }

  return `(${bahtStr})`
}

const LEVEL1_RE = /^J[A-Z]-\d{3,4}$/

export default function QuotationPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string
  const isLevel1 = LEVEL1_RE.test(code)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [rows, setRows] = useState<QuoteRow[]>([])

  // Header & Meta state
  const [contactPerson, setContactPerson] = useState('คุณณัฐนนท์')
  const [department, setDepartment] = useState('BU 2')
  const [docNo, setDocNo] = useState(`JB-${code.replace(/^J[A-Z]-/, '')}-001`)
  const [docDate, setDocDate] = useState(todayISO())
  const [submitDate, setSubmitDate] = useState(todayISO())
  const [priceValidDays, setPriceValidDays] = useState('30')

  // Discount & Tax state
  const [discountPercent, setDiscountPercent] = useState(10)
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatRate, setVatRate] = useState(7)
  const [remarks, setRemarks] = useState('')

  // Signatures
  const [salesPerson, setSalesPerson] = useState('Rungtip Buasa-ard')
  const [approverPerson, setApproverPerson] = useState('Mr. Sakda Phumchaai')
  const [salesDate, setSalesDate] = useState(todayISO())
  const [approvalDate, setApprovalDate] = useState(todayISO())
  const [buyerDate, setBuyerDate] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const query = isLevel1 ? `level1=${encodeURIComponent(code)}` : `level2=${encodeURIComponent(code)}`

      // 1. Fetch system jobs for item list
      const jobsRes = await fetch(`/api/jobs?${query}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const jobsJson = await jobsRes.json()
      const jobs: Job[] = Array.isArray(jobsJson) ? jobsJson : (jobsJson.jobs ?? [])

      let initialRows: QuoteRow[] = []
      if (jobs.length > 0) {
        initialRows = jobs.map((j) => ({
          job_code: j.job_code,
          drawing_name: j.drawing_name || '',
          material: j.material || j.coating || 'SUS304',
          unit: 'pc.',
          quantity: j.quantity || 1,
          unit_price: 100,
        }))
      } else {
        initialRows = [
          { job_code: `ME-${code}-01-009-0012`, drawing_name: '', material: 'POM WHITE', unit: 'pc.', quantity: 24, unit_price: 150 },
          { job_code: `ME-${code}-01-009-0014`, drawing_name: '', material: 'SUS304', unit: 'pc.', quantity: 8, unit_price: 100 },
          { job_code: `ME-${code}-01-009-0016`, drawing_name: '', material: 'SS400', unit: 'pc.', quantity: 8, unit_price: 105 },
          { job_code: `ME-${code}-01-009-0018`, drawing_name: '', material: 'SS400', unit: 'pc.', quantity: 32, unit_price: 80 },
          { job_code: `ME-${code}-01-009-0019`, drawing_name: '', material: 'SS400', unit: 'pc.', quantity: 8, unit_price: 105 },
        ]
      }

      // 2. Fetch saved quotation data from DB if exists
      const qRes = await fetch(`/api/quotations/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const qJson = await qRes.json()
      const saved = qJson?.quotation

      if (saved) {
        if (saved.contact_person) setContactPerson(saved.contact_person)
        if (saved.department) setDepartment(saved.department)
        if (saved.doc_no) setDocNo(saved.doc_no)
        if (saved.doc_date) setDocDate(saved.doc_date)
        if (saved.submit_date) setSubmitDate(saved.submit_date)
        if (saved.price_valid_days) setPriceValidDays(saved.price_valid_days)
        if (typeof saved.discount_percent === 'number') setDiscountPercent(saved.discount_percent)
        if (typeof saved.vat_enabled === 'boolean') setVatEnabled(saved.vat_enabled)
        if (typeof saved.vat_rate === 'number') setVatRate(saved.vat_rate)
        if (saved.remarks) setRemarks(saved.remarks)
        if (saved.sales_person) setSalesPerson(saved.sales_person)
        if (saved.approver_person) setApproverPerson(saved.approver_person)
        if (saved.sales_date) setSalesDate(saved.sales_date)
        if (saved.approval_date) setApprovalDate(saved.approval_date)
        if (saved.buyer_date) setBuyerDate(saved.buyer_date)

        if (Array.isArray(saved.rows) && saved.rows.length > 0) {
          const savedRows: QuoteRow[] = saved.rows
          const savedMap = new Map(savedRows.map((r) => [r.job_code, r]))
          initialRows = initialRows.map((r) => {
            const savedRow = savedMap.get(r.job_code)
            if (savedRow) {
              return {
                ...r,
                material: savedRow.material ?? r.material,
                unit: savedRow.unit ?? r.unit,
                quantity: typeof savedRow.quantity === 'number' ? savedRow.quantity : r.quantity,
                unit_price: typeof savedRow.unit_price === 'number' ? savedRow.unit_price : r.unit_price,
              }
            }
            return r
          })
        }
      }

      setRows(initialRows)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [code, isLevel1])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const token = getToken()
      const body = {
        contact_person: contactPerson,
        department: department,
        doc_no: docNo,
        doc_date: docDate,
        submit_date: submitDate,
        price_valid_days: priceValidDays,
        discount_percent: discountPercent,
        vat_enabled: vatEnabled,
        vat_rate: vatRate,
        remarks: remarks,
        sales_person: salesPerson,
        approver_person: approverPerson,
        sales_date: salesDate,
        approval_date: approvalDate,
        buyer_date: buyerDate,
        rows: rows,
      }

      const res = await fetch(`/api/quotations/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSaving(false)
    }
  }

  function updateRow(idx: number, patch: Partial<QuoteRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function addBlankRow() {
    setRows((prev) => [...prev, { job_code: `CUSTOM-${prev.length + 1}`, drawing_name: '', material: '', unit: 'pc.', quantity: 1, unit_price: 0 }])
  }

  const totalQuantity = rows.reduce((s, r) => s + (r.quantity || 0), 0)
  const subtotal = rows.reduce((s, r) => s + (r.quantity || 0) * (r.unit_price || 0), 0)
  const discountAmount = (subtotal * discountPercent) / 100
  const afterDiscount = subtotal - discountAmount
  const vatAmount = vatEnabled ? (afterDiscount * vatRate) / 100 : 0
  const netTotal = afterDiscount + vatAmount

  // Pad to 25 rows for official quotation layout
  const paddedRowsCount = Math.max(25, rows.length)
  const displayRows = Array.from({ length: paddedRowsCount }).map((_, i) => {
    if (i < rows.length) return { ...rows[i], index: i + 1, isReal: true }
    return {
      index: i + 1,
      job_code: '0',
      drawing_name: '',
      material: '0',
      unit: 'pc.',
      quantity: 0,
      unit_price: 0,
      isReal: false,
    }
  })

  const gridBorder = '1px solid #475569'
  const boxBorder = '1px solid #334155'

  return (
    <div id="print-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: '#d1d5db',
      overflowY: 'auto',
      fontFamily: 'Tahoma, Arial, sans-serif',
    }}>
      <style>{`
        @media screen {
          .print-page {
            border: 1px solid #cbd5e1;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            margin-bottom: 30px;
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
          #pages-wrap { padding: 20px; }
          .print-only { display: none !important; }
          .q-input {
            border: 1px solid #cbd5e1;
            border-radius: 2px;
            padding: 1px 4px;
            background: #fff;
          }
          .q-input[type=number] {
            -moz-appearance: textfield;
          }
          .q-input[type=number]::-webkit-outer-spin-button,
          .q-input[type=number]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
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
          .print-page {
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            width: 210mm !important;
            min-height: 295mm !important;
            box-sizing: border-box !important;
          }
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
          .q-input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
          @page { size: A4 portrait; margin: 5mm; }
        }
      `}</style>

      {/* Toolbar */}
      <div id="toolbar">
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> กลับ
        </button>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#e0e0ff' }}>
          ใบเสนอราคา / QUOTATION — JOB {code}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveSuccess && (
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              ✓ บันทึกสำเร็จ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#2563eb', color: '#fff', border: 'none',
              borderRadius: '20px', padding: '8px 18px',
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
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

      {/* Main A4 Page */}
      <div id="pages-wrap">
        <div
          className="print-page"
          style={{
            width: '210mm',
            minHeight: '295mm',
            padding: '8mm 10mm',
            boxSizing: 'border-box',
            backgroundColor: '#fff',
            color: '#000',
            fontFamily: 'Tahoma, Arial, sans-serif',
            margin: '0 auto',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            {/* Logo & Company Name */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <img src="/logo.svg" alt="SISTOMAT" style={{ height: '42px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }} />
              <div>
                <div style={{ color: '#002060', fontWeight: 'bold', fontSize: '15px', lineHeight: '1.2' }}>
                  บริษัท สยาม อินทิเกรชั่น ซิสเต็มส์ จำกัด (สำนักงานใหญ่)
                </div>
                <div style={{ fontSize: '10px', color: '#000', marginTop: '2px', lineHeight: '1.3' }}>
                  75/33 หมู่ที่ 11 ตำบล คลองหนึ่ง อำเภอ คลองหลวง จังหวัด ปทุมธานี 12120<br />
                  โทร. 02-529-0880 ต่อ 113 , 095-8400163<br />
                  E-mail : bu10@sistomat.com
                </div>
              </div>
            </div>

            {/* Quotation Title Box */}
            <div style={{
              border: boxBorder,
              padding: '6px 20px',
              textAlign: 'center',
              minWidth: '170px',
              position: 'relative',
            }}>
              <span style={{ position: 'absolute', top: 2, right: 6, fontSize: '8px', color: '#444' }}>02/01/2023 Rev.01</span>
              <div style={{ color: '#002060', fontWeight: 'bold', fontSize: '18px', marginTop: '4px' }}>ใบเสนอราคา</div>
              <div style={{ color: '#002060', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px', marginTop: '2px' }}>QUOTATION</div>
            </div>
          </div>

          {/* Meta Grid (Two side-by-side tables) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {/* Customer Box */}
            <div style={{ flex: 1, border: boxBorder }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '85px', fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder }}>ชื่อผู้ติดต่อ</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, fontWeight: 'bold' }}>
                      <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="q-input" style={{ width: '100%', fontWeight: 'bold', fontSize: '11px' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder }}>แผนก</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder }}>
                      <input value={department} onChange={(e) => setDepartment(e.target.value)} className="q-input" style={{ width: '100%', fontSize: '11px' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder }}>JOB</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, fontSize: '11px' }}>{code}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder }}>จำนวนชิ้นงาน</td>
                    <td style={{ padding: '3px 6px', fontSize: '11px' }}>{totalQuantity}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Doc Info Box */}
            <div style={{ width: '260px', border: boxBorder }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '130px', fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder, whiteSpace: 'nowrap' }}>เลขที่เอกสาร / Doc No</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'center' }}>
                      <input value={docNo} onChange={(e) => setDocNo(e.target.value)} className="q-input" style={{ width: '100%', textAlign: 'center', fontSize: '11px' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder, whiteSpace: 'nowrap' }}>วันที่เอกสาร / Date</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'center' }}>
                      <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="q-input no-print" style={{ fontSize: '10px' }} />
                      <span className="print-only">{formatShortThaiDate(docDate)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, borderBottom: gridBorder, whiteSpace: 'nowrap' }}>กำหนดส่งงาน/ Submit</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'center' }}>
                      <input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} className="q-input no-print" style={{ fontSize: '10px' }} />
                      <span className="print-only">{formatShortThaiDate(submitDate)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '3px 6px', borderRight: gridBorder, whiteSpace: 'nowrap' }}>ยืนราคาระภายใน/Price s</td>
                    <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                      <input value={priceValidDays} onChange={(e) => setPriceValidDays(e.target.value)} className="q-input" style={{ width: '30px', textAlign: 'center', fontSize: '11px' }} /> วัน
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table Container */}
          <div style={{ position: 'relative', border: boxBorder, marginBottom: '0px' }}>
            {/* Watermark */}
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '52px',
              fontWeight: 'bold',
              color: 'rgba(0, 0, 0, 0.14)',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 1,
            }}>
              หน้า 1
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', position: 'relative', zIndex: 2 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#000' }}>
                  <th style={{ border: gridBorder, padding: '4px 2px', width: '32px', textAlign: 'center', fontWeight: 'bold' }}>ลำดับ<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Item</span></th>
                  <th style={{ border: gridBorder, padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>รายการ<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Description</span></th>
                  <th style={{ border: gridBorder, padding: '4px 4px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>วัตถุดิบ<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Mat'L</span></th>
                  <th style={{ border: gridBorder, padding: '4px 2px', width: '40px', textAlign: 'center', fontWeight: 'bold' }}>หน่วย<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Unit</span></th>
                  <th style={{ border: gridBorder, padding: '4px 2px', width: '45px', textAlign: 'center', fontWeight: 'bold' }}>จำนวน<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Quantity</span></th>
                  <th style={{ border: gridBorder, padding: '4px 4px', width: '90px', textAlign: 'center', fontWeight: 'bold' }}>ราคา/หน่วย<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Unit Price</span></th>
                  <th style={{ border: gridBorder, padding: '4px 6px', width: '105px', textAlign: 'center', fontWeight: 'bold' }}>จำนวนเงิน/บาท<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Amount</span></th>
                  <th style={{ border: gridBorder, padding: '4px 2px', width: '24px' }} className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr key={i} style={{ height: '20px' }}>
                    <td style={{ border: gridBorder, textAlign: 'center', padding: '1px 2px' }}>{r.index}</td>
                    {/* Item (รายการ) is Read-Only */}
                    <td style={{ border: gridBorder, padding: '1px 6px' }}>
                      {r.isReal ? (
                        <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: '500' }}>
                          {r.job_code}{r.drawing_name ? ` (${r.drawing_name})` : ''}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td style={{ border: gridBorder, textAlign: 'center', padding: '1px 4px' }}>
                      {r.isReal ? (
                        <input
                          value={r.material}
                          onChange={(e) => updateRow(i, { material: e.target.value })}
                          className="q-input"
                          style={{ width: '100%', textAlign: 'center', fontSize: '10px' }}
                        />
                      ) : (
                        '0'
                      )}
                    </td>
                    <td style={{ border: gridBorder, textAlign: 'center', padding: '1px 2px' }}>{r.unit}</td>
                    <td style={{ border: gridBorder, textAlign: 'center', padding: '1px 2px' }}>
                      {r.isReal ? (
                        <input
                          type="number"
                          value={r.quantity}
                          onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })}
                          className="q-input"
                          style={{ width: '100%', textAlign: 'center', fontSize: '10px' }}
                        />
                      ) : (
                        '0'
                      )}
                    </td>
                    <td style={{ border: gridBorder, textAlign: 'right', padding: '1px 6px' }}>
                      {r.isReal ? (
                        <input
                          type="number"
                          step="0.01"
                          value={r.unit_price}
                          onChange={(e) => updateRow(i, { unit_price: Number(e.target.value) || 0 })}
                          className="q-input"
                          style={{ width: '100%', textAlign: 'right', fontSize: '10px' }}
                        />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ border: gridBorder, textAlign: 'right', padding: '1px 6px', fontWeight: r.isReal ? 'bold' : 'normal' }}>
                      {r.isReal ? formatMoney(r.quantity * r.unit_price) : '-'}
                    </td>
                    <td style={{ border: gridBorder, textAlign: 'center', padding: '1px' }} className="no-print">
                      {r.isReal && (
                        <button onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c00' }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 6px' }} className="no-print">
            <button
              onClick={addBlankRow}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px dashed #475569', background: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
            >
              <Plus size={12} /> เพิ่มแถวว่าง
            </button>
          </div>

          {/* Footer Summary Section */}
          <div style={{ display: 'flex', gap: '8px', border: boxBorder, borderTop: 'none', marginTop: '-1px', marginBottom: '8px' }}>
            {/* Left Remarks & Baht Text */}
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: gridBorder }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#002060', fontSize: '11px', marginBottom: '2px' }}>หมายเหตุ :</div>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="กรอกหมายเหตุย่อย..."
                  className="q-input"
                  style={{ width: '100%', height: '45px', resize: 'none', fontSize: '10px' }}
                />
              </div>

              {/* Thai Baht text */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginTop: 'auto', paddingTop: '4px' }}>
                {bahtText(netTotal)}
              </div>
            </div>

            {/* Right Amounts Grid */}
            <div style={{ width: '280px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, borderRight: gridBorder, fontWeight: 'bold' }}>รวมเป็นเงิน / Total net Value</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'right', fontWeight: 'bold', width: '90px' }}>{formatMoney(subtotal)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, borderRight: gridBorder, color: '#cc0000', fontWeight: 'bold' }}>
                      ส่วนลด / Discount{' '}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                        className="q-input no-print"
                        style={{
                          width: '46px',
                          textAlign: 'center',
                          fontSize: '11px',
                          color: '#cc0000',
                          fontWeight: 'bold',
                          padding: '1px 4px',
                          margin: '0 2px',
                        }}
                      />
                      <span className="print-only">{discountPercent}</span>%
                    </td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'right', color: '#cc0000', fontWeight: 'bold' }}>
                      {discountAmount > 0 ? formatMoney(discountAmount) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, borderRight: gridBorder, fontWeight: 'bold' }}>ยอดหลังหักส่วนลด /After discount</td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(afterDiscount)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, borderRight: gridBorder, fontWeight: 'bold' }}>
                      <label className="no-print" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} style={{ marginRight: '3px' }} />
                      </label>
                      ภาษีมูลค่าเพิ่ม / Vat Amount
                    </td>
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, textAlign: 'right' }}>{vatEnabled ? formatMoney(vatAmount) : '-'}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '4px 6px', borderRight: gridBorder, fontWeight: 'bold', fontSize: '11px' }}>รวมราคาสุทธิ / Total Amount</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', color: '#002060' }}>{formatMoney(netTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Box (Full Width) */}
          <div style={{ border: boxBorder, padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              {/* Sales Person */}
              <div style={{ width: '48%' }}>
                <div style={{ marginBottom: '6px' }}>
                  ผู้เสนอราคา.{' '}
                  <input
                    value={salesPerson}
                    onChange={(e) => setSalesPerson(e.target.value)}
                    className="q-input"
                    style={{ color: '#002060', fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px', border: 'none' }}
                  />
                </div>
                <div style={{ marginBottom: '6px' }}>
                  วันที่{' '}
                  <input
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                    className="q-input no-print"
                    style={{ fontSize: '10px', marginLeft: '4px' }}
                  />
                  <span>{formatShortThaiDate(salesDate)}</span>
                </div>
                <div style={{ marginBottom: '6px' }}>ผู้สั่งซื้อ........................................................</div>
                <div>
                  วันที่{' '}
                  <input
                    type="date"
                    value={buyerDate}
                    onChange={(e) => setBuyerDate(e.target.value)}
                    className="q-input no-print"
                    style={{ fontSize: '10px', marginLeft: '4px' }}
                  />
                  <span>{buyerDate ? formatShortThaiDate(buyerDate) : '........./........./.........'}</span>
                </div>
              </div>

              {/* Approver Person */}
              <div style={{ width: '48%', textAlign: 'right' }}>
                <div style={{ color: '#002060', fontWeight: 'bold', fontSize: '11px', marginBottom: '6px' }}>
                  บริษัท สยาม อินทิเกรชั่น ซิสเต็มส์ จำกัด (สำนักงานใหญ่)
                </div>
                <div style={{ marginBottom: '6px' }}>
                  ผู้อนุมัติ.{' '}
                  <input
                    value={approverPerson}
                    onChange={(e) => setApproverPerson(e.target.value)}
                    className="q-input"
                    style={{ color: '#002060', fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px', textAlign: 'right', border: 'none' }}
                  />
                </div>
                <div>
                  วันที่{' '}
                  <input
                    type="date"
                    value={approvalDate}
                    onChange={(e) => setApprovalDate(e.target.value)}
                    className="q-input no-print"
                    style={{ fontSize: '10px', marginLeft: '4px' }}
                  />
                  <span>{formatShortThaiDate(approvalDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
