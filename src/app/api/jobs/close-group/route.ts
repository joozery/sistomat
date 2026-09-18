import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

type AuthPayload = { username?: string; role?: string }

function verifySuperadmin(req: NextRequest): AuthPayload {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ')
    ? auth.slice(7)
    : req.cookies.get('auth_token')?.value
  if (!token) throw new Error('Unauthorized')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
  const role = payload.role?.trim().toLowerCase()
  if (role !== 'superadmin') throw new Error('Forbidden')
  return payload
}

export async function PUT(req: NextRequest) {
  let actor: AuthPayload
  try {
    actor = verifySuperadmin(req)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const level2 = typeof body.level2 === 'string' ? body.level2.trim().toUpperCase() : ''
    const closed = body.closed !== false
    if (!/^J?[A-Z]+-\d{3,4}-\d{3}$/.test(level2)) {
      return NextResponse.json({ error: 'รูปแบบรหัสกลุ่มงานไม่ถูกต้อง' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const changedAt = new Date()
    const update = closed
      ? { $set: { sale_closed_at: changedAt, sale_closed_by: actor.username ?? '' } }
      : { $unset: { sale_closed_at: '', sale_closed_by: '' } }
    const result = await db.collection('jobs').updateMany({ level2 }, update)

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: `ไม่พบกลุ่มงาน ${level2}` }, { status: 404 })
    }

    await Promise.all([
      db.collection('projects').updateMany(
        { level2 },
        update
      ),
      db.collection('activity_logs').insertOne({
        username: actor.username ?? '',
        role: actor.role ?? '',
        action: closed ? 'close_sale_group' : 'reopen_sale_group',
        target: level2,
        detail: `${closed ? 'ปิด' : 'เปิด'}การขายกลุ่ม ${level2}`,
        created_at: changedAt,
      }),
    ])

    return NextResponse.json({
      level2,
      closed,
      sale_closed_at: closed ? changedAt : null,
      updated: result.modifiedCount,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
