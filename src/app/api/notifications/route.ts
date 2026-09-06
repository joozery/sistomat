import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

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

const initialSeedData = [
  {
    type: 'warning',
    category: 'machine',
    title: 'เครื่องจักร CNC 2 แจ้งเตือนตรวจเช็กน้ำมันหล่อเย็น',
    description: 'ระดับน้ำมันหล่อเย็นลดลงต่ำกว่า 20% กรุณาเติมก่อนเริ่มขั้นตอนการผลิตถัดไป',
    time: '10 นาทีที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
    created_at: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    type: 'success',
    category: 'qc',
    title: 'การสแกน QR Code ใบงาน #JOB-8842 เสร็จสิ้น',
    description: 'ขั้นตอน LATHE 1 ดำเนินการเสร็จสมบูรณ์ ชิ้นงานผ่านการตรวจสอบคุณภาพเบื้องต้น 100%',
    time: '35 นาทีที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
    created_at: new Date(Date.now() - 35 * 60 * 1000),
  },
  {
    type: 'error',
    category: 'qc',
    title: 'พบชิ้นงานไม่ผ่านเกณฑ์ QC ในขั้นตอน #JOB-8845',
    description: 'พบรอยขีดข่วนบนพื้นผิวชิ้นงานเกินค่าพิกัดความคลาดเคลื่อน 0.05 mm กรุณาตรวจสอบ',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
    link: '/dashboard/process-details/JD-2025-001',
    created_at: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    type: 'info',
    category: 'inventory',
    title: 'การเบิกจ่ายวัตถุดิบสำเร็จ (เหล็กเพลา S45C)',
    description: 'ฝ่าย MAT ดำเนินการเบิกจ่ายวัตถุดิบสำหรับแพลนงานประจำสัปดาห์เรียบร้อยแล้ว',
    time: '3 ชั่วโมงที่แล้ว',
    read: true,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    type: 'info',
    category: 'system',
    title: 'อัปเดตระบบ SISTOMAT ERP v2.4 สำเร็จ',
    description: 'ปรับปรุงประสิทธิภาพการสแกน QR Code และเพิ่มความเร็วในการโหลดตารางกระบวนการ',
    time: 'เมื่อวานนี้',
    read: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
]

export async function GET(req: NextRequest) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const collection = db.collection('notifications')

    const count = await collection.countDocuments()
    if (count === 0) {
      await collection.insertMany(initialSeedData)
    }

    const items = await collection.find({}).sort({ created_at: -1 }).toArray()

    const notifications = items.map((doc) => ({
      id: doc._id.toString(),
      type: doc.type,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      time: doc.time || 'เมื่อครู่นี้',
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
    const { type, category, title, description, time, link } = body

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
      time: time || 'เมื่อครู่นี้',
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
