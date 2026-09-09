import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
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

// GET /api/settings/inspectors — any authenticated user (ใช้เลือกในหน้า QC)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const items = await db.collection('inspectors').find({}).sort({ name: 1 }).toArray()

    return NextResponse.json(
      items.map((i) => ({
        id: i._id.toString(),
        name: i.name,
        signature_url: i.signature_url || null,
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/settings/inspectors — { name, signature_url? } — Admin only
export async function POST(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { name, signature_url } = body
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ตรวจ' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const result = await db.collection('inspectors').insertOne({
      name: String(name).trim(),
      signature_url: signature_url || null,
      created_at: new Date(),
    })

    return NextResponse.json({ message: 'เพิ่มผู้ตรวจสำเร็จ', id: result.insertedId }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/inspectors — { id, name?, signature_url? } — Admin only
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { id, name, signature_url } = body
    if (!id) return NextResponse.json({ error: 'กรุณาระบุ id' }, { status: 400 })

    const $set: Record<string, unknown> = { updated_at: new Date() }
    if (name !== undefined) $set.name = String(name).trim()
    if (signature_url !== undefined) $set.signature_url = signature_url || null

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const result = await db.collection('inspectors').updateOne({ _id: new ObjectId(id) }, { $set })
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ตรวจ' }, { status: 404 })
    }

    return NextResponse.json({ message: 'อัปเดตสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/settings/inspectors?id=... — Admin only
export async function DELETE(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'กรุณาระบุ id' }, { status: 400 })

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const result = await db.collection('inspectors').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ตรวจ' }, { status: 404 })
    }

    return NextResponse.json({ message: 'ลบสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
