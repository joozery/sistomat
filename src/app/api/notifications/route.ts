import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'
import { timeAgo } from '@/lib/timeAgo'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyToken(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  jwt.verify(token, process.env.JWT_SECRET!)
}

export async function GET(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const collection = db.collection('notifications')

    const items = await collection.find({}).sort({ created_at: -1 }).limit(50).toArray()

    const notifications = items.map((doc) => ({
      id: doc._id.toString(),
      type: doc.type,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      time: timeAgo(doc.created_at ?? new Date()),
      read: Boolean(doc.read),
      link: doc.link,
    }))

    const unreadCount = notifications.filter((n) => !n.read).length

    return NextResponse.json({ notifications, unreadCount })
  } catch (e) {
    console.error('[GET /api/notifications]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, category, title, description, link } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const newDoc = {
      type: type || 'info',
      category: category || 'system',
      title,
      description: description || '',
      read: false,
      link: link || null,
      created_at: new Date(),
    }

    const res = await db.collection('notifications').insertOne(newDoc)

    return NextResponse.json({
      message: 'Created notification',
      notification: { id: res.insertedId.toString(), ...newDoc },
    }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/notifications]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const collection = db.collection('notifications')

    if (body.markAllRead) {
      await collection.updateMany({ read: false }, { $set: { read: true } })
      return NextResponse.json({ message: 'Marked all as read' })
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filter: Record<string, any> = {}
    if (ObjectId.isValid(body.id)) {
      filter = { _id: new ObjectId(body.id) }
    } else {
      filter = { _id: body.id }
    }

    await collection.updateOne(filter, { $set: { read: Boolean(body.read) } })
    return NextResponse.json({ message: 'Updated notification' })
  } catch (e) {
    console.error('[PATCH /api/notifications]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const collection = db.collection('notifications')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filter: Record<string, any> = {}
    if (ObjectId.isValid(id)) {
      filter = { _id: new ObjectId(id) }
    } else {
      filter = { _id: id }
    }

    await collection.deleteOne(filter)
    return NextResponse.json({ message: 'Deleted notification' })
  } catch (e) {
    console.error('[DELETE /api/notifications]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
