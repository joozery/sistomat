import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return request.cookies.get('auth_token')?.value ?? null
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    jwt.verify(token, JWT_SECRET)

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const projects = await db
      .collection('projects')
      .find({ type: { $ne: 'job' } })
      .sort({ received_date: -1 })
      .toArray()

    // แปลง _id เป็น string เพื่อ serialize JSON
    const serialized = projects.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    )
  }
}
