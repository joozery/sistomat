import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  id: string
  username: string
  role: string
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function decodeToken(req: NextRequest): JwtPayload | null {
  const token = getToken(req)
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
  } catch {
    return null
  }
}

// ─── GET — list activity logs ───────────────────────────────
export async function GET(req: NextRequest) {
  const user = decodeToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username') || ''
    const action   = searchParams.get('action') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo   = searchParams.get('dateTo') || ''
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit    = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {}
    if (username) filter.username = { $regex: username, $options: 'i' }
    if (action)   filter.action = action
    if (dateFrom || dateTo) {
      filter.created_at = {}
      if (dateFrom) filter.created_at.$gte = new Date(dateFrom)
      if (dateTo)   filter.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const col = db.collection('activity_logs')

    const skip = (page - 1) * limit
    const [logs, total] = await Promise.all([
      col.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])

    return NextResponse.json({ logs, total, page, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── POST — record an activity ──────────────────────────────
export async function POST(req: NextRequest) {
  const user = decodeToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { action, target, detail } = body

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    const client = await getClientPromise()
    const db = client.db('sistomat')

    await db.collection('activity_logs').insertOne({
      username: user.username,
      role: user.role,
      action,
      target: target ?? '',
      detail: detail ?? '',
      created_at: new Date(),
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
