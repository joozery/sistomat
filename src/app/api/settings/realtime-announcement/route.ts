import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

type AuthPayload = {
  username?: string
  role?: string
}

type AnnouncementInput = {
  id?: unknown
  message?: unknown
  enabled?: unknown
}

type Announcement = {
  id: string
  message: string
  enabled: boolean
}

function readAnnouncements(doc: Record<string, unknown> | null): Announcement[] {
  if (Array.isArray(doc?.announcements)) {
    return (doc.announcements as AnnouncementInput[])
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `announcement-${index + 1}`,
        message: typeof item.message === 'string' ? item.message : '',
        enabled: Boolean(item.enabled),
      }))
      .filter((item) => item.message)
  }

  const legacyMessage = typeof doc?.message === 'string' ? doc.message : ''
  return legacyMessage
    ? [{ id: 'announcement-1', message: legacyMessage, enabled: Boolean(doc?.enabled) }]
    : []
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyAuth(req: NextRequest): AuthPayload {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
}

function verifyAdmin(req: NextRequest): AuthPayload {
  const payload = verifyAuth(req)
  const role = payload.role?.trim().toLowerCase()
  if (role !== 'admin' && role !== 'superadmin') throw new Error('Forbidden')
  return payload
}

export async function GET(req: NextRequest) {
  try {
    verifyAuth(req)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const doc = await client.db('sistomat').collection('settings').findOne({
      key: 'realtime_announcement',
    })

    return NextResponse.json({ announcements: readAnnouncements(doc) })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let payload: AuthPayload
  try {
    payload = verifyAdmin(req)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    if (!Array.isArray(body.announcements) || body.announcements.length > 20) {
      return NextResponse.json({ error: 'ประกาศต้องเป็นรายการและมีได้สูงสุด 20 รายการ' }, { status: 400 })
    }

    const announcements: Announcement[] = (body.announcements as AnnouncementInput[]).map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `announcement-${Date.now()}-${index}`,
      message: typeof item.message === 'string' ? item.message.trim() : '',
      enabled: Boolean(item.enabled),
    }))

    if (announcements.some((item) => !item.message || item.message.length > 500)) {
      return NextResponse.json({ error: 'ประกาศแต่ละรายการต้องมีข้อความ 1–500 ตัวอักษร' }, { status: 400 })
    }

    const client = await getClientPromise()
    await client.db('sistomat').collection('settings').updateOne(
      { key: 'realtime_announcement' },
      {
        $set: {
          announcements,
          updated_by: payload.username ?? '',
          updated_at: new Date(),
        },
        $unset: { message: '', enabled: '' },
      },
      { upsert: true }
    )

    return NextResponse.json({ announcements })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
