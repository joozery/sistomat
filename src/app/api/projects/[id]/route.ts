import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { id } = await params
    const client = await clientPromise
    const db = client.db('sistomat')

    const project = await db.collection('projects').findOne({ project_id: id })
    if (!project) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    return NextResponse.json({ ...project, _id: project._id.toString() })
  } catch (e) {
    console.error('GET /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { id } = await params
    const body = await req.json()
    const { processes, status } = body

    const client = await clientPromise
    const db = client.db('sistomat')

    const update: Record<string, unknown> = { updated_at: new Date() }
    if (processes !== undefined) update.processes = processes
    if (status !== undefined) update.status = status

    const result = await db
      .collection('projects')
      .updateOne({ project_id: id }, { $set: update })

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    return NextResponse.json({ message: 'บันทึกสำเร็จ' })
  } catch (e) {
    console.error('PUT /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
