import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyAdmin(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string }
  if (payload.role !== 'Admin') throw new Error('Forbidden')
}

// ─── GET /api/users ────────────────────────────────────────
export async function GET(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .sort({ created_at: -1 })
      .toArray()
    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── POST /api/users ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { username, password, role, name, code, email, phone, machines } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก username และ password' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const existing = await db.collection('users').findOne({ username })
    if (existing) {
      return NextResponse.json({ error: `Username "${username}" มีอยู่แล้ว` }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await db.collection('users').insertOne({
      username,
      password: hash,
      role: role || 'User',
      name: name || '',
      code: code ? Number(code) : null,
      email: email || '',
      phone: phone || '',
      machines: Array.isArray(machines) ? machines : [],
      created_at: new Date(),
    })

    return NextResponse.json({ message: 'สร้างผู้ใช้งานสำเร็จ', id: result.insertedId }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── PUT /api/users ────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { id, username, password, role, name, code, email, phone, machines } = body

    if (!id) return NextResponse.json({ error: 'กรุณาระบุ id' }, { status: 400 })

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $set: Record<string, any> = { updated_at: new Date() }
    if (username !== undefined) $set.username = username
    if (role !== undefined) $set.role = role
    if (name !== undefined) $set.name = name
    if (code !== undefined) $set.code = code ? Number(code) : null
    if (email !== undefined) $set.email = email
    if (phone !== undefined) $set.phone = phone
    if (machines !== undefined) $set.machines = Array.isArray(machines) ? machines : []
    if (password) $set.password = await bcrypt.hash(password, 10)

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งาน' }, { status: 404 })
    }

    return NextResponse.json({ message: 'อัปเดตสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── DELETE /api/users ─────────────────────────────────────
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

    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งาน' }, { status: 404 })
    }

    return NextResponse.json({ message: 'ลบผู้ใช้งานสำเร็จ' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
