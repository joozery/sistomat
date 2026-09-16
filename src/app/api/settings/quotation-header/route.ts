import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function verifyAuth(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  jwt.verify(token, process.env.JWT_SECRET!)
}

function verifyAdmin(req: NextRequest) {
  const token = getToken(req)
  if (!token) throw new Error('Unauthorized')
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string }
  if (payload.role !== 'Admin' && payload.role !== 'superadmin') throw new Error('Forbidden')
}

interface QuotationHeader {
  company_name: string
  address: string
  phone: string
  email: string
  logo_url: string
}

// ค่าเริ่มต้น — ใช้ครั้งแรกเท่านั้นตอนยังไม่มี doc ใน DB (ค่าเดียวกับที่เคย hardcode ไว้ในหน้าใบเสนอราคา)
const DEFAULT_HEADER: QuotationHeader = {
  company_name: 'บริษัท สยาม อินทิเกรชั่น ซิสเต็มส์ จำกัด (สำนักงานใหญ่)',
  address: '75/33 หมู่ที่ 11 ตำบล คลองหนึ่ง อำเภอ คลองหลวง จังหวัด ปทุมธานี 12120',
  phone: 'โทร. 02-529-0880 ต่อ 113 , 095-8400163',
  email: 'bu10@sistomat.com',
  logo_url: '/logo.svg',
}

// GET /api/settings/quotation-header — any authenticated user (ใช้แสดงในหน้าใบเสนอราคา)
export async function GET(req: NextRequest) {
  try { verifyAuth(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const doc = await db.collection('settings').findOne({ key: 'quotation_header' })

    if (!doc) {
      await db.collection('settings').insertOne({
        key: 'quotation_header',
        ...DEFAULT_HEADER,
        updated_at: new Date(),
      })
      return NextResponse.json(DEFAULT_HEADER)
    }

    return NextResponse.json({
      company_name: doc.company_name ?? DEFAULT_HEADER.company_name,
      address: doc.address ?? DEFAULT_HEADER.address,
      phone: doc.phone ?? DEFAULT_HEADER.phone,
      email: doc.email ?? DEFAULT_HEADER.email,
      logo_url: doc.logo_url ?? DEFAULT_HEADER.logo_url,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/settings/quotation-header — { company_name, address, phone, email, logo_url } — Admin only
export async function PUT(req: NextRequest) {
  try { verifyAdmin(req) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  try {
    const body = await req.json()
    const { company_name, address, phone, email, logo_url } = body

    if ([company_name, address, phone, email, logo_url].some((v) => typeof v !== 'string')) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const cleaned: QuotationHeader = {
      company_name: company_name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      logo_url: logo_url.trim(),
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    await db.collection('settings').updateOne(
      { key: 'quotation_header' },
      { $set: { ...cleaned, updated_at: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกสำเร็จ', ...cleaned })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
