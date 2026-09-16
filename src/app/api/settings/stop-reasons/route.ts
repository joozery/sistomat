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

// เหตุผลการหยุดงานเริ่มต้น — ใช้ครั้งแรกเท่านั้นตอนยังไม่มี doc ใน DB
const DEFAULT_STOP_REASONS = ['จบงาน', 'พักกินข้าว', 'พักเบรก', 'รอวัตถุดิบ', 'เครื่องขัดข้อง', 'อื่นๆ']

// GET /api/settings/stop-reasons — any authenticated user (ใช้แสดงใน dropdown ตอนสแกนหยุดงาน)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'stop_reasons' })

    if (!doc) {
      await db.collection('settings').insertOne({
        key: 'stop_reasons',
        options: DEFAULT_STOP_REASONS,
        updated_at: new Date(),
      })
      return NextResponse.json({ options: DEFAULT_STOP_REASONS })
    }

    return NextResponse.json({ options: doc.options ?? DEFAULT_STOP_REASONS })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/stop-reasons — { options: string[] } — Admin only
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { options } = body

    if (!Array.isArray(options) || options.some((o) => typeof o !== 'string')) {
      return NextResponse.json({ error: 'options ต้องเป็น array ของ string' }, { status: 400 })
    }

    const cleaned = options.map((o: string) => o.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'ต้องมีอย่างน้อย 1 ตัวเลือก' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'stop_reasons' },
      { $set: { options: cleaned, updated_at: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกสำเร็จ', options: cleaned })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
