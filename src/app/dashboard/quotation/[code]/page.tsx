'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { useMachineRates } from '@/lib/useMachineRates'
import { useQuotationHeader } from '@/lib/useQuotationHeader'

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
  // ประเมินราคา fields
  mat_type?: string
  mat_size?: string
  mat_cost?: number
  coating_cost?: number
  wc_cost?: number
  extra_price?: number
}

interface MachineRate {
  process: string
  rate: number
}

interface JobProcess {
  process: string
  target_time: string
}

const DEFAULT_MACHINE_RATES: MachineRate[] = [
  { process: 'Material-PO',  rate: 200 },
  { process: 'Material-CUT', rate: 200 },
  { process: 'QC',           rate: 200 },
  { process: 'CAM',          rate: 500 },
  { process: 'CNC',          rate: 500 },
  { process: 'Spar',         rate: 200 },
  { process: 'ML',           rate: 200 },
  { process: 'Lathe',        rate: 200 },
  { process: 'TAP',          rate: 200 },
]

// แปลง target_time แบบ "HH:MM" (หรือ "H:MM") เป็นจำนวนชั่วโมง
function parseTargetHours(t: string): number {
  if (!t) return 0
  const parts = t.split(':').map((n) => Number(n))
  const h = parts[0]
  const m = parts[1]
  if (isNaN(h)) return 0
  return h + (isNaN(m) ? 0 : m / 60)
}

// จับคู่ชื่อกระบวนการจาก process-details กับตาราง ค่า ชม.เครื่อง แบบ fuzzy
// (เช่น "CAM1" จับคู่กับ "CAM" ได้ และ "MATERAIL" จับคู่กับ "Material-PO"/"Material-CUT"
// ได้แม้สะกดสลับตัวอักษรกัน — เทียบตัวอักษรที่เรียงใหม่แล้วของคำแรกในชื่อเรท)
function letterSet(s: string): string {
  return [...s.replace(/[^A-Z]/g, '')].sort().join('')
}
function findMachineRate(processName: string, rates: MachineRate[]): number {
  const target = processName.trim().toUpperCase()
  if (!target) return 0
  const targetLetters = letterSet(target)
  const match = rates.find((r) => {
    const rp = r.process.trim().toUpperCase()
    if (rp === target || target.includes(rp) || rp.includes(target)) return true
    const rpFirstWord = rp.split(/[\s-]/)[0]
    return letterSet(rpFirstWord) === targetLetters
  })
  return match?.rate ?? 0
}

// ราคา WC ต่อชิ้น = รวม (เวลาเป้าหมายแต่ละกระบวนการ x ค่า ชม.เครื่อง) ของทุกกระบวนการใน
// process-details ของ job นี้ แล้วหารด้วยจำนวนที่ทำ
function calcWcPricePerPiece(processes: JobProcess[], rates: MachineRate[], quantity: number): number {
  if (!quantity) return 0
  const totalCost = processes.reduce((sum, p) => sum + parseTargetHours(p.target_time) * findMachineRate(p.process, rates), 0)
  return totalCost / quantity
}

// สูตร ประเมินราคา
function calcRow(r: QuoteRow) {
  const qty        = r.quantity    || 0
  const matCost    = r.mat_cost    || 0
  const coating    = r.coating_cost|| 0
  const wc         = r.wc_cost     || 0
  const extra      = r.extra_price || 0
  const totalMat   = matCost * qty
  const totalOut   = wc + coating * qty
  const netPer     = matCost + coating + wc + extra
  const total      = netPer * qty
  return { totalMat, totalOut, netPer, total }
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ใช้เฉพาะ "วันที่" ใต้ผู้เสนอราคาเท่านั้น — เช่น "15 Monday 2026"
function formatDayWeekdayYear(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = d.getDate()
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
    const year = d.getFullYear()
    return `${weekday} ${day} ${year}`
  } catch {
    return dateStr
  }
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

// แสดงเลขโปรเจกต์แบบดิบ (ไม่มี J นำหน้า, ตัดส่วน level2/3 ทิ้ง) — เช่น "JA-8888-001" -> "A-8888"
function deriveJobDisplay(code: string) {
  const m = code.match(/^([A-Z]+)(-\d{3,4})/)
  if (!m) return code
  const prefix = m[1].startsWith('J') ? m[1].slice(1) : m[1]
  return `${prefix}${m[2]}`
}

export default function QuotationPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string
  const isLevel1 = LEVEL1_RE.test(code)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [rows, setRows] = useState<QuoteRow[]>([])
  // process-details ของแต่ละ job_code (ดึงมาเพื่อคำนวณราคา WC อัตโนมัติ) — คีย์ด้วย job_code
  const [jobProcesses, setJobProcesses] = useState<Record<string, JobProcess[]>>({})

  // Header & Meta state
  const [contactPerson, setContactPerson] = useState('')
  const [department, setDepartment] = useState('BU 2')
  const [docNo, setDocNo] = useState(code)
  const [docDate, setDocDate] = useState(todayISO())
  const [submitDate, setSubmitDate] = useState(todayISO())
  const [priceValidDays, setPriceValidDays] = useState('30')

  const [activeTab, setActiveTab] = useState<'quote' | 'estimate'>('quote')
  // อ่านอย่างเดียว — ตั้งค่าได้ที่หน้า "ตั้งค่าระบบ" > "ค่า ชม.เครื่อง" เท่านั้น
  const [machineRates, setMachineRates] = useState<MachineRate[]>(DEFAULT_MACHINE_RATES)
  const { rates: defaultMachineRates } = useMachineRates()
  // อ่านอย่างเดียว — ตั้งค่าได้ที่หน้า "ตั้งค่าระบบ" > "หัวกระดาษใบเสนอราคา" เท่านั้น
  const { header: quotationHeader } = useQuotationHeader()

  // Discount & Tax state
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [discountValue, setDiscountValue] = useState(10)
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatRate, setVatRate] = useState(7)
  const [remarks, setRemarks] = useState('')

  // Signatures
  const [salesPerson, setSalesPerson] = useState('Rungtip Buasa-ard')
  const [approverPerson, setApproverPerson] = useState('Mr. prasert senachai')
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
        if (typeof saved.discount_percent === 'number') setDiscountValue(saved.discount_percent)
        if (saved.discount_type === 'amount' || saved.discount_type === 'percent') setDiscountType(saved.discount_type)
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
              return { ...r, ...savedRow }
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

  // ดึง process-details (target_time ของแต่ละกระบวนการ) ของทุก job_code ในตาราง
  // มาเก็บไว้คำนวณราคา WC อัตโนมัติ — ดึงครั้งเดียวต่อ job_code ที่ยังไม่มีใน cache
  useEffect(() => {
    const token = getToken()
    const missing = rows.filter((r) => r.job_code && !(r.job_code in jobProcesses))
    if (missing.length === 0) return
    missing.forEach(async (r) => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(r.job_code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          setJobProcesses((prev) => ({ ...prev, [r.job_code]: [] }))
          return
        }
        const data = await res.json()
        const rawProcesses: { process?: string; target_time?: string }[] = Array.isArray(data.processes) ? data.processes : []
        const processes: JobProcess[] = rawProcesses.map((p) => ({ process: p.process ?? '', target_time: p.target_time ?? '' }))
        setJobProcesses((prev) => ({ ...prev, [r.job_code]: processes }))
      } catch {
        setJobProcesses((prev) => ({ ...prev, [r.job_code]: [] }))
      }
    })
  }, [rows, jobProcesses])

  // ค่า ชม.เครื่อง อ่านอย่างเดียว ดึงจากหน้า "ตั้งค่าระบบ" เสมอ — แก้ได้ที่หน้านั้นที่เดียว
  useEffect(() => {
    if (defaultMachineRates.length > 0) setMachineRates(defaultMachineRates)
  }, [defaultMachineRates])

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
        discount_percent: discountValue,
        discount_type: discountType,
        vat_enabled: vatEnabled,
        vat_rate: vatRate,
        remarks: remarks,
        sales_person: salesPerson,
        approver_person: approverPerson,
        sales_date: salesDate,
        approval_date: approvalDate,
        buyer_date: buyerDate,
        // snapshot the auto-computed WC price (target_time x ค่า ชม.เครื่อง / จำนวน) ณ ตอนบันทึก
        rows: rows.map((r) => ({
          ...r,
          extra_price: calcWcPricePerPiece(jobProcesses[r.job_code] ?? [], machineRates, r.quantity),
        })),
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

  function handleTableArrowNavigation(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return

    const current = event.target as HTMLElement
    if (!current.matches('input, select, textarea')) return

    const cell = current.closest('td') as HTMLTableCellElement | null
    const row = cell?.closest('tr') as HTMLTableRowElement | null
    const table = row?.closest('table')
    if (!cell || !row || !table) return

    const isEditable = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false
      if (element.matches(':disabled, [type="hidden"]')) return false
      return element.matches('input, select, textarea')
    }

    let next: HTMLElement | undefined
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const fields = Array.from(row.querySelectorAll('input, select, textarea')).filter(isEditable)
      const index = fields.indexOf(current)
      const offset = event.key === 'ArrowLeft' ? -1 : 1
      next = fields[index + offset]
    } else {
      const rows = Array.from(table.rows)
      const rowIndex = rows.indexOf(row)
      const offset = event.key === 'ArrowUp' ? -1 : 1

      for (let i = rowIndex + offset; i >= 0 && i < rows.length; i += offset) {
        const targetCell = Array.from(rows[i].cells).find((candidate) => candidate.cellIndex === cell.cellIndex)
        const field = targetCell?.querySelector('input, select, textarea')
        if (field && isEditable(field)) {
          next = field
          break
        }
      }
    }

    if (!next) return
    event.preventDefault()
    next.focus()
    if (next instanceof HTMLInputElement && next.type !== 'date') next.select()
  }

  const totalQuantity = rows.reduce((s, r) => s + (r.quantity || 0), 0)
  const subtotal = rows.reduce((s, r) => s + (r.quantity || 0) * (r.unit_price || 0), 0)
  const discountAmount = discountType === 'percent' ? (subtotal * discountValue) / 100 : discountValue
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
    <div id="print-overlay" onKeyDown={handleTableArrowNavigation} style={{
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

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('quote')}
            style={{
              padding: '6px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 'bold', transition: 'all 0.15s',
              backgroundColor: activeTab === 'quote' ? '#7B1A1A' : '#2d2d4e',
              color: activeTab === 'quote' ? '#fff' : '#888',
            }}
          >
            ใบเสนอราคา
          </button>
          <button
            onClick={() => setActiveTab('estimate')}
            style={{
              padding: '6px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 'bold', transition: 'all 0.15s',
              backgroundColor: activeTab === 'estimate' ? '#2563eb' : '#2d2d4e',
              color: activeTab === 'estimate' ? '#fff' : '#888',
            }}
          >
            ประเมินราคาใบที่ 1
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveSuccess && (
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              ✓ บันทึกสำเร็จ
            </span>
          )}
          {/* Sync netPer → unit_price when on estimate tab */}
          {activeTab === 'estimate' && (
            <button
              onClick={() => {
                setRows((prev) => prev.map((r) => {
                  const extra_price = calcWcPricePerPiece(jobProcesses[r.job_code] ?? [], machineRates, r.quantity)
                  const c = calcRow({ ...r, extra_price })
                  // เก็บราคาแบบเต็มความละเอียดไว้ (ไม่ปัดตรงนี้) แล้วค่อยปัดตอนแสดงผล/รวมยอด —
                  // ถ้าปัดทศนิยม 2 ตำแหน่งให้ unit_price ก่อนคูณจำนวน จะสะสมคลาดเคลื่อนจนยอดรวมไม่ลงตัว
                  // (เช่น ราคาที่แท้จริงคือ 213.3333... คูณ 4 ชิ้น ควรได้ 853.33 พอดี แต่ถ้าปัดราคาก่อนเป็น 213.33
                  // จะได้ 853.32 แทน)
                  const next = c.netPer > 0 ? { ...r, unit_price: c.netPer } : r
                  return r.mat_type?.trim() ? { ...next, material: r.mat_type.trim() } : next
                }))
                setActiveTab('quote')
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#059669', color: '#fff', border: 'none',
                borderRadius: '20px', padding: '7px 14px',
                fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              }}
              title="นำ ราคาสุทธิ/ชิ้น และ ชนิดแมท จากสูตร ไปเป็นราคาขาย/วัตถุดิบในใบเสนอราคา"
            >
              ส่งราคาสุทธิ → ใบเสนอ
            </button>
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

      {/* Dynamic print @page size based on active tab */}
      {activeTab === 'estimate' && (
        <style>{'@media print { @page { size: A4 landscape; margin: 5mm; } }'}</style>
      )}

      {/* Main A4 Page */}
      <div id="pages-wrap">
        {/* ─── Tab: ใบเสนอราคา ─── */}
        {activeTab === 'quote' && <div
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
              <img src={quotationHeader?.logo_url || '/logo.svg'} alt={quotationHeader?.company_name || 'SISTOMAT'} style={{ height: '42px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }} />
              <div>
                <div style={{ color: '#002060', fontWeight: 'bold', fontSize: '15px', lineHeight: '1.2' }}>
                  {quotationHeader?.company_name}
                </div>
                <div style={{ fontSize: '10px', color: '#000', marginTop: '2px', lineHeight: '1.3' }}>
                  {quotationHeader?.address}<br />
                  {quotationHeader?.phone}<br />
                  E-mail : {quotationHeader?.email}
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
                      <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="รอใส่ชื่อ" className="q-input" style={{ width: '100%', fontWeight: 'bold', fontSize: '11px' }} />
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
                    <td style={{ padding: '3px 6px', borderBottom: gridBorder, fontSize: '11px' }}>{deriveJobDisplay(code)}</td>
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
                          value={Math.round(r.unit_price * 100) / 100}
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
                        max={discountType === 'percent' ? 100 : undefined}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
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
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as 'percent' | 'amount')}
                        className="no-print"
                        style={{
                          fontSize: '10px',
                          color: '#cc0000',
                          fontWeight: 'bold',
                          padding: '1px 2px',
                          border: '1px solid #cc0000',
                          borderRadius: '3px',
                          background: 'white',
                        }}
                      >
                        <option value="percent">%</option>
                        <option value="amount">บาท</option>
                      </select>
                      <span className="print-only">
                        {discountValue}{discountType === 'percent' ? '%' : ' บาท'}
                      </span>
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
                  <span>{formatDayWeekdayYear(salesDate)}</span>
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
        </div>}

        {/* ─── Tab: ประเมินราคาใบที่ 1 ─── */}
        {activeTab === 'estimate' && (() => {
          const p2Border = '1px solid #555'
          const p2th = (extra?: React.CSSProperties): React.CSSProperties => ({
            border: p2Border, padding: '2px 3px', textAlign: 'center',
            fontWeight: 'bold', fontSize: '9px', backgroundColor: '#d0d0d0', ...extra,
          })
          const p2td = (extra?: React.CSSProperties): React.CSSProperties => ({
            border: p2Border, padding: '1px 3px', fontSize: '9px', ...extra,
          })
          const p2tdc = (extra?: React.CSSProperties): React.CSSProperties => ({
            border: p2Border, padding: '1px 3px', fontSize: '9px', textAlign: 'center', ...extra,
          })
          const numInput = (val: number | undefined, onChange: (v: number) => void): React.CSSProperties => ({
            width: '100%', border: 'none', background: 'transparent', fontSize: '9px',
            textAlign: 'right', fontFamily: 'Tahoma, Arial, sans-serif',
          })

          // ราคา = ดึงกระบวนการ + เวลาเป้าหมายจาก process-details ของ job นี้ x ค่า ชม.เครื่อง แล้วหารด้วยจำนวน
          // (แทนการกรอกเอง) — ถ้ายังโหลด process-details ไม่เสร็จ ใช้ 0 ไปก่อน
          const getComputedExtra = (r: QuoteRow) =>
            calcWcPricePerPiece(jobProcesses[r.job_code] ?? [], machineRates, r.quantity)
          const withComputedExtra = (r: QuoteRow): QuoteRow => ({ ...r, extra_price: getComputedExtra(r) })

          // Totals
          const totQty  = rows.reduce((s, r) => s + (r.quantity || 0), 0)
          const totF    = rows.reduce((s, r) => s + (r.mat_cost || 0), 0)
          const totG    = rows.reduce((s, r) => s + (r.coating_cost || 0), 0)
          const totH    = rows.reduce((s, r) => s + (r.wc_cost || 0), 0)
          const totI    = rows.reduce((s, r) => s + getComputedExtra(r), 0)
          const totJ    = rows.reduce((s, r) => s + calcRow(withComputedExtra(r)).totalMat, 0)
          const totK    = rows.reduce((s, r) => s + calcRow(withComputedExtra(r)).totalOut, 0)
          const totL    = rows.reduce((s, r) => s + calcRow(withComputedExtra(r)).netPer, 0)
          const totM    = rows.reduce((s, r) => s + calcRow(withComputedExtra(r)).total, 0)
          const expense = totJ + totK
          const profit  = totM - expense

          const p2Rows = Array.from({ length: Math.max(25, rows.length) }).map((_, i) =>
            i < rows.length ? { ...rows[i], index: i + 1, isReal: true } : { index: i + 1, isReal: false }
          )

          return (
            <div
              className="print-page"
              style={{
                width: '297mm', minHeight: '210mm',
                padding: '6mm 8mm', boxSizing: 'border-box',
                backgroundColor: '#fff', color: '#000',
                fontFamily: 'Tahoma, Arial, sans-serif',
                margin: '0 auto',
              }}
            >
              <style>{`
                @media print {
                  .print-page + .print-page { page-break-before: always; }
                  .print-page:nth-child(2) { width: 297mm !important; min-height: 210mm !important; }
                  @page :nth(2) { size: A4 landscape; }
                }
              `}</style>

              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#002060' }}>
                ประเมินราคาใบที่ 1 — JOB {code}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {/* ── Main Table ── */}
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={p2th({ width: '22px' })}>ลำดับ</th>
                        <th style={p2th()}>ชื่องาน</th>
                        <th style={p2th({ width: '28px' })}>จำนวน</th>
                        <th style={p2th({ width: '52px' })}>ชนิดแมท</th>
                        <th style={p2th({ width: '60px' })}>ขนาดแมท</th>
                        <th style={p2th({ width: '38px' })}>ค่าแมท</th>
                        <th style={p2th({ width: '30px' })}>ชุบ</th>
                        <th style={p2th({ width: '36px' })}>WC</th>
                        <th style={p2th({ width: '36px' })}>ราคา</th>
                        <th style={p2th({ width: '42px' })}>รวมค่าแมท</th>
                        <th style={p2th({ width: '50px' })}>รวมค่าจ้างนอก</th>
                        <th style={p2th({ width: '52px' })}>ราคาสุทธิ/ชิ้น</th>
                        <th style={p2th({ width: '48px' })}>ราคารวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p2Rows.map((r, i) => {
                        const rr = r as QuoteRow
                        const c = r.isReal ? calcRow(withComputedExtra(rr)) : { totalMat: 0, totalOut: 0, netPer: 0, total: 0 }
                        return (
                          <tr key={i} style={{ height: '18px' }}>
                            <td style={p2tdc()}>{r.index}</td>
                            <td style={p2td()}>
                              {r.isReal ? <span style={{ fontSize: '8px' }}>{rr.job_code}{rr.drawing_name ? ` (${rr.drawing_name})` : ''}</span> : ''}
                            </td>
                            <td style={p2tdc()}>
                              {r.isReal
                                ? <input type="number" value={rr.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 0 })} style={numInput(rr.quantity, () => {})} />
                                : ''}
                            </td>
                            <td style={p2td()}>
                              {r.isReal
                                ? <input value={rr.mat_type || ''} onChange={(e) => updateRow(i, { mat_type: e.target.value })} style={{ ...numInput(0, () => {}), textAlign: 'left' }} />
                                : ''}
                            </td>
                            <td style={p2td()}>
                              {r.isReal
                                ? <input value={rr.mat_size || ''} onChange={(e) => updateRow(i, { mat_size: e.target.value })} style={{ ...numInput(0, () => {}), textAlign: 'left' }} />
                                : ''}
                            </td>
                            <td style={p2tdc()}>
                              {r.isReal
                                ? <input type="number" value={rr.mat_cost ?? ''} onChange={(e) => updateRow(i, { mat_cost: Number(e.target.value) || 0 })} style={numInput(rr.mat_cost, () => {})} />
                                : ''}
                            </td>
                            <td style={p2tdc()}>
                              {r.isReal
                                ? <input type="number" value={rr.coating_cost ?? ''} onChange={(e) => updateRow(i, { coating_cost: Number(e.target.value) || 0 })} style={numInput(rr.coating_cost, () => {})} />
                                : ''}
                            </td>
                            <td style={p2tdc()}>
                              {r.isReal
                                ? <input type="number" value={rr.wc_cost ?? ''} onChange={(e) => updateRow(i, { wc_cost: Number(e.target.value) || 0 })} style={numInput(rr.wc_cost, () => {})} />
                                : ''}
                            </td>
                            <td style={p2tdc()} title="เวลาเป้าหมาย x ค่า ชม.เครื่อง ของแต่ละกระบวนการใน process-details ของ job นี้ หารด้วยจำนวน">
                              {r.isReal
                                ? (jobProcesses[rr.job_code]
                                  ? (getComputedExtra(rr) ? formatMoney(getComputedExtra(rr)) : '-')
                                  : <Loader2 size={9} className="animate-spin" style={{ display: 'inline' }} />)
                                : ''}
                            </td>
                            <td style={p2tdc({ color: '#333' })}>{r.isReal && c.totalMat ? formatMoney(c.totalMat) : ''}</td>
                            <td style={p2tdc({ color: '#333' })}>{r.isReal && c.totalOut ? formatMoney(c.totalOut) : ''}</td>
                            <td style={p2tdc({ fontWeight: 'bold' })}>{r.isReal && c.netPer ? formatMoney(c.netPer) : ''}</td>
                            <td style={p2tdc({ fontWeight: 'bold', color: '#002060' })}>{r.isReal && c.total ? formatMoney(c.total) : ''}</td>
                          </tr>
                        )
                      })}
                      {/* Totals row */}
                      <tr style={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
                        <td colSpan={2} style={p2tdc({ fontWeight: 'bold' })}>รวม</td>
                        <td style={p2tdc()}>{totQty}</td>
                        <td colSpan={2} style={p2td()}></td>
                        <td style={p2tdc()}>{totF ? formatMoney(totF) : ''}</td>
                        <td style={p2tdc()}>{totG ? formatMoney(totG) : ''}</td>
                        <td style={p2tdc()}>{totH ? formatMoney(totH) : ''}</td>
                        <td style={p2tdc()}>{totI ? formatMoney(totI) : ''}</td>
                        <td style={p2tdc()}>{totJ ? formatMoney(totJ) : ''}</td>
                        <td style={p2tdc()}>{totK ? formatMoney(totK) : ''}</td>
                        <td style={p2tdc()}>{totL ? formatMoney(totL) : ''}</td>
                        <td style={p2tdc({ color: '#002060' })}>{totM ? formatMoney(totM) : ''}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Summary */}
                  <table style={{ width: '60%', borderCollapse: 'collapse', marginTop: '6px', marginLeft: 'auto' }}>
                    <tbody>
                      <tr>
                        <td style={p2th({ width: '80px' })}>QUO.NO</td>
                        <td style={p2th({ width: '120px' })}>JOB NO</td>
                        <td style={p2th()}>ค่าใช้จ่าย</td>
                        <td style={p2th()}>ส่วนลด</td>
                        <td style={p2th()}>ราคาสุทธิ</td>
                        <td style={p2th()}>กำไร</td>
                      </tr>
                      <tr>
                        <td style={p2tdc()}>{docNo}</td>
                        <td style={p2tdc()}>{code}</td>
                        <td style={p2tdc({ fontWeight: 'bold' })}>{expense ? formatMoney(expense) : '-'}</td>
                        <td style={p2tdc()}>{discountValue > 0 ? (discountType === 'percent' ? `${discountValue}%` : formatMoney(discountValue)) : '-'}</td>
                        <td style={p2tdc({ fontWeight: 'bold', color: '#002060' })}>{totM ? formatMoney(totM) : '-'}</td>
                        <td style={p2tdc({ fontWeight: 'bold', color: profit >= 0 ? '#006600' : '#cc0000' })}>{totM ? formatMoney(profit) : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Machine Rates Table ── */}
                <div style={{ width: '120px', flexShrink: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th colSpan={2} style={p2th({ backgroundColor: '#b0b0b0' })}>ค่า ชม.เครื่อง</th>
                      </tr>
                      <tr>
                        <th style={p2th({ width: '70px' })}>กระบวนการ</th>
                        <th style={p2th()}>บาท/ชม.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineRates.map((mr, mi) => (
                        <tr key={mi}>
                          <td style={{ ...p2td(), fontSize: '9px', fontFamily: 'Tahoma, Arial, sans-serif' }}>
                            {mr.process}
                          </td>
                          <td style={{ ...p2tdc(), fontSize: '9px', textAlign: 'right', fontFamily: 'Tahoma, Arial, sans-serif' }}>
                            {mr.rate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
