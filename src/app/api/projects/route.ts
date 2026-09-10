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

    const { searchParams } = new URL(request.url)
    const process  = searchParams.get('process')
    const search   = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo   = searchParams.get('dateTo')
    const pageNum  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit    = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))

    // ── Mode: filter by process name → paginated response for all-plans detail ──
    if (process) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: Record<string, any> = {
        'processes.process': {
          $regex: `^${process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      }
      if (search) {
        filter.$or = [
          { project_id: { $regex: search, $options: 'i' } },
          { dwg_name:   { $regex: search, $options: 'i' } },
        ]
      }
      if (dateFrom || dateTo) {
        filter.due_date = {}
        if (dateFrom) filter.due_date.$gte = dateFrom
        if (dateTo)   filter.due_date.$lte = dateTo
      }
      const skip = (pageNum - 1) * limit
      const [docs, total] = await Promise.all([
        db.collection('projects').find(filter).sort({ due_date: 1, project_id: 1 }).skip(skip).limit(limit).toArray(),
        db.collection('projects').countDocuments(filter),
      ])
      const jobs = docs.map((p) => ({
        _id: p._id.toString(),
        job_code:     p.project_id ?? '',
        drawing_name: p.dwg_name   ?? '',
        quantity:     p.quantity   ?? 1,
        status:       p.status     ?? '',
        due_date:     typeof p.due_date === 'string' ? p.due_date : (p.due_date ? new Date(p.due_date).toISOString() : ''),
      }))
      return NextResponse.json({ jobs, total, page: pageNum, limit })
    }

    // ── Default mode: return plain array (backward compatible for process-qrcode) ──
    const projects = await db
      .collection('projects')
      .find({ type: { $ne: 'job' } })
      .sort({ received_date: -1 })
      .toArray()

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
