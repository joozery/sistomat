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

// GET /api/workers/block — returns array of blocked worker codes
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch (e: unknown) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const client = await getClientPromise()
  const db = client.db('sistomat')
  const blocked = await db.collection('blocked_workers').find({}).toArray()
  return NextResponse.json(blocked.map((b) => b.code as number))
}

// POST /api/workers/block — { code: number, name: string, block: boolean }
export async function POST(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }
  const { code, name, block } = await req.json()
  if (typeof code !== 'number') return NextResponse.json({ error: 'invalid code' }, { status: 400 })

  const client = await getClientPromise()
  const db = client.db('sistomat')

  if (block) {
    await db.collection('blocked_workers').updateOne(
      { code },
      { $set: { code, name: name ?? '', blocked_at: new Date() } },
      { upsert: true },
    )
  } else {
    await db.collection('blocked_workers').deleteOne({ code })
  }

  return NextResponse.json({ ok: true })
}
