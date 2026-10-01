import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (token) return token
  }
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyAdmin(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }
    const role = (payload.role ?? '').trim().toLowerCase()
    if (role !== 'admin' && role !== 'superadmin' && role !== 'administrator') {
      throw new Error('Forbidden')
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Forbidden') throw err
    throw new Error('Unauthorized')
  }
}

// GET /api/settings/system-name — Public branding data (ใช้แสดงใต้โลโก้ใน Sidebar และหน้าต่างๆ)
export async function GET() {
  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'system_name' })

    return NextResponse.json({
      sub_name: typeof doc?.sub_name === 'string' ? doc.sub_name : '',
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/system-name — { sub_name: string } — Admin / Superadmin only
export async function PUT(req: NextRequest) {
  try {
    verifyAdmin(req)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sub_name = typeof body.sub_name === 'string' ? body.sub_name.trim() : ''

    const client = await getClientPromise()
    const db = client.db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'system_name' },
      { $set: { sub_name, updated_at: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกสำเร็จ', sub_name })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
