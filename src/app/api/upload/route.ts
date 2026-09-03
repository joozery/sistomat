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

const ALLOWED_EXT = ['pdf', 'stl', 'step', 'stp', 'obj', '3mf', 'glb', 'gltf']

function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !projectId) {
    return NextResponse.json({ message: 'Missing file or projectId' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ message: 'ไฟล์ต้องเป็น PDF หรือไฟล์ 3D (stl, step, obj, 3mf)' }, { status: 400 })
  }

  const safeProject = projectId.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const timestamp = Date.now()
  const key = `projects/${safeProject}/${timestamp}_${file.name}`

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
