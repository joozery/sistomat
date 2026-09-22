import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getRole(req: NextRequest): string | null {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? req.cookies.get('auth_token')?.value
  if (!token) return null
  try { return (jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }).role ?? '' }
  catch { return null }
}

export async function GET(req: NextRequest) {
  if (getRole(req) === null) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try {
    const db = (await getClientPromise()).db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'qc_signatures' })
    return NextResponse.json({ qc_signature_url: doc?.qc_signature_url ?? '', approve_signature_url: doc?.approve_signature_url ?? '' })
  } catch {
    return NextResponse.json({ message: 'โหลดลายเซ็นไม่สำเร็จ' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const role = getRole(req)
  if (role === null) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (role !== 'Admin' && role !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    if (typeof body.qc_signature_url !== 'string' || typeof body.approve_signature_url !== 'string') {
      return NextResponse.json({ message: 'ข้อมูลลายเซ็นไม่ถูกต้อง' }, { status: 400 })
    }
    const db = (await getClientPromise()).db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'qc_signatures' },
      { $set: {
        qc_signature_url: body.qc_signature_url.trim(),
        approve_signature_url: body.approve_signature_url.trim(),
        updated_at: new Date(),
      } },
      { upsert: true },
    )
    return NextResponse.json({ message: 'บันทึกสำเร็จ' })
  } catch {
    return NextResponse.json({ message: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}
