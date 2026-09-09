import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']

function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

// POST /api/upload/signature — Admin only (จัดการจากหน้าตั้งค่า)
export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role: string }
    if (payload.role !== 'Admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ message: 'Missing file' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ message: 'ไฟล์ลายเซ็นต้องเป็นรูปภาพ (png, jpg, webp, svg)' }, { status: 400 })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9_.\-]/g, '_')
  const key = `signatures/${timestamp}_${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: file.type || 'application/octet-stream',
    ContentLength: buffer.length,
  }))

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
  return NextResponse.json({ publicUrl })
}
