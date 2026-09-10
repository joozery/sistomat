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

// เกณฑ์ overtime เริ่มต้น — ยังไม่มี grace period จนกว่า Admin จะตั้งค่า
const DEFAULT_GRACE_MINUTES = 0

// GET /api/settings/overtime — any authenticated user (ใช้คำนวณสถานะ OVERTIME ในหน้า realtime)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'overtime_threshold' })

    if (!doc) {
      await db.collection('settings').insertOne({
        key: 'overtime_threshold',
        grace_minutes: DEFAULT_GRACE_MINUTES,
        updated_at: new Date(),
      })
      return NextResponse.json({ graceMinutes: DEFAULT_GRACE_MINUTES })
    }

    return NextResponse.json({ graceMinutes: doc.grace_minutes ?? DEFAULT_GRACE_MINUTES })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/overtime — { graceMinutes: number } — Admin only
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { graceMinutes } = body

    if (typeof graceMinutes !== 'number' || !Number.isFinite(graceMinutes) || graceMinutes < 0) {
      return NextResponse.json({ error: 'graceMinutes ต้องเป็นตัวเลขที่ไม่ติดลบ' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'overtime_threshold' },
      { $set: { grace_minutes: graceMinutes, updated_at: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกสำเร็จ', graceMinutes })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
