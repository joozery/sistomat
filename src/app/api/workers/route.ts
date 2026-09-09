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

// GET /api/workers — list all workers (any authenticated user; needed for
// the barcode scanner / process-details / realtime pages, not just Admin)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const workers = await db.collection('workers').find({}).sort({ code: 1 }).toArray()

    return NextResponse.json(
      workers.map((w) => ({
        id: w._id.toString(),
        code: w.code,
        name: w.name,
        machines: w.machines ?? [],
        username: w.username || undefined,
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/workers — { code, name, machines, username? }
export async function POST(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { code, name, machines, username } = body

    if (code === undefined || code === null || !name) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสและชื่อพนักงาน' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const existing = await db.collection('workers').findOne({ code: Number(code) })
    if (existing) {
      return NextResponse.json({ error: `รหัสพนักงาน "${code}" มีอยู่แล้ว` }, { status: 409 })
    }

    const result = await db.collection('workers').insertOne({
      code: Number(code),
      name,
      machines: Array.isArray(machines) ? machines : [],
      username: username || null,
      created_at: new Date(),
    })

    return NextResponse.json({ message: 'เพิ่มพนักงานสำเร็จ', id: result.insertedId }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/workers — { id, code, name, machines, username? }
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { id, code, name, machines, username } = body
    if (!id) return NextResponse.json({ error: 'กรุณาระบุ id' }, { status: 400 })

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const $set: Record<string, unknown> = { updated_at: new Date() }
    if (code !== undefined) $set.code = Number(code)
    if (name !== undefined) $set.name = name
    if (machines !== undefined) $set.machines = Array.isArray(machines) ? machines : []
    if (username !== undefined) $set.username = username || null

    const result = await db.collection('workers').updateOne({ _id: new ObjectId(id) }, { $set })
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 })
    }

    return NextResponse.json({ message: 'อัปเดตสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/workers?id=...
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

    const result = await db.collection('workers').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 })
    }

    return NextResponse.json({ message: 'ลบพนักงานสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
