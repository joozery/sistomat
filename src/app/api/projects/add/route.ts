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

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    jwt.verify(token, JWT_SECRET)

    const { projectId, dwgName, receivedDate, dueDate } = await request.json()

    if (!projectId || !receivedDate || !dueDate) {
      return NextResponse.json(
        { message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')

    // เช็คว่า project_id ซ้ำหรือเปล่า
    const existing = await db.collection('projects').findOne({ project_id: projectId })
    if (existing) {
      return NextResponse.json(
        { message: `เลขที่โปรเจค "${projectId}" มีอยู่แล้วในระบบ` },
        { status: 409 }
      )
    }

    const newProject = {
      project_id: projectId,
      dwg_name: dwgName?.trim() || '',
      received_date: new Date(receivedDate),
      due_date: new Date(dueDate),
      status: 'กำลังดำเนินการ',
      created_at: new Date(),
    }

    const result = await db.collection('projects').insertOne(newProject)

    return NextResponse.json(
      { message: 'เพิ่มโปรเจคสำเร็จ', id: result.insertedId.toString() },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/projects/add error:', error)
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
      { status: 500 }
    )
  }
}
