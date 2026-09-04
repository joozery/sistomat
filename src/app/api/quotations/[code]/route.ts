import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> | { code: string } }) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const code = resolvedParams.code
    const client = await getClientPromise()
    const db = client.db('sistomat')

    const quotation = await db.collection('quotations').findOne({ code })
    return NextResponse.json({ quotation: quotation ?? null })
  } catch (e) {
    console.error('[GET /api/quotations/[code]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> | { code: string } }) {
  try { verifyToken(req) } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const code = resolvedParams.code
    const body = await req.json()

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const quotationData = {
      code,
      contact_person: body.contact_person ?? '',
      department: body.department ?? '',
      doc_no: body.doc_no ?? '',
      doc_date: body.doc_date ?? '',
      submit_date: body.submit_date ?? '',
      price_valid_days: body.price_valid_days ?? '',
      discount_percent: Number(body.discount_percent) || 0,
      vat_enabled: Boolean(body.vat_enabled),
      vat_rate: Number(body.vat_rate) || 7,
      remarks: body.remarks ?? '',
      sales_person: body.sales_person ?? '',
      approver_person: body.approver_person ?? '',
      sales_date: body.sales_date ?? '',
      approval_date: body.approval_date ?? '',
      buyer_date: body.buyer_date ?? '',
      rows: Array.isArray(body.rows) ? body.rows : [],
      updated_at: new Date(),
    }

    await db.collection('quotations').updateOne(
      { code },
      { $set: quotationData },
      { upsert: true }
    )

    return NextResponse.json({ message: 'บันทึกใบเสนอราคาสำเร็จ', quotation: quotationData })
  } catch (e) {
    console.error('[POST /api/quotations/[code]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
