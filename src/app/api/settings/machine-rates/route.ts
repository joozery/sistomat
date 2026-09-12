import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyAuth(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  jwt.verify(token, process.env.JWT_SECRET!)
}

function verifyAdmin(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string }
  if (payload.role !== 'Admin') throw new Error('Forbidden')
}

interface MachineRate {
  process: string
  rate: number
}

// ค่าเริ่มต้น — ใช้ครั้งแรกเท่านั้นตอนยังไม่มี doc ใน DB (ค่าเดียวกับที่เคย hardcode ไว้ในหน้า quotation)
const DEFAULT_MACHINE_RATES: MachineRate[] = [
  { process: 'Material-PO', rate: 200 },
  { process: 'Material-CUT', rate: 200 },
  { process: 'QC', rate: 200 },
  { process: 'CAM', rate: 500 },
  { process: 'CNC', rate: 500 },
  { process: 'Spar', rate: 200 },
  { process: 'ML', rate: 200 },
  { process: 'Lathe', rate: 200 },
  { process: 'TAP', rate: 200 },
]

// GET /api/settings/machine-rates — any authenticated user (ใช้เป็นค่าเริ่มต้นใน dropdown ของหน้า quotation)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'machine_rates' })

    if (!doc) {
      await db.collection('settings').insertOne({
        key: 'machine_rates',
        rates: DEFAULT_MACHINE_RATES,
        updated_at: new Date(),
      })
      return NextResponse.json({ rates: DEFAULT_MACHINE_RATES })
    }

    return NextResponse.json({ rates: doc.rates ?? DEFAULT_MACHINE_RATES })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/machine-rates — { rates: MachineRate[] } — Admin only
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { rates } = body

    if (
      !Array.isArray(rates) ||
      rates.some((r) => typeof r?.process !== 'string' || typeof r?.rate !== 'number')
    ) {
      return NextResponse.json({ error: 'rates ต้องเป็น array ของ { process: string, rate: number }' }, { status: 400 })
    }

    const cleaned = rates
      .map((r) => ({ process: String(r.process).trim(), rate: Number(r.rate) || 0 }))
      .filter((r) => r.process)

    const client = await getClientPromise()
    const db = client.db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'machine_rates' },
      { $set: { rates: cleaned, updated_at: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกสำเร็จ', rates: cleaned })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
