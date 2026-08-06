import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const { searchParams } = new URL(req.url)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {}

    const level1    = searchParams.get('level1')
    const level2    = searchParams.get('level2')
    const process   = searchParams.get('process')
    const search    = searchParams.get('search')
    const dateFrom  = searchParams.get('dateFrom')
    const dateTo    = searchParams.get('dateTo')
    const pageNum   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit     = Math.min(200, parseInt(searchParams.get('limit') ?? '50', 10))

    if (level1)   filter.level1 = level1
    if (level2)   filter.level2 = level2

    // Filter by process name (exact match, case-insensitive)
    if (process) {
      filter['processes.process'] = { $regex: `^${process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }

    // Text search on job_code or drawing_name
    if (search) {
      filter.$or = [
        { job_code: { $regex: search, $options: 'i' } },
        { drawing_name: { $regex: search, $options: 'i' } },
      ]
    }

    // Date range on due_date
    if (dateFrom || dateTo) {
      filter.due_date = {}
      if (dateFrom) filter.due_date.$gte = dateFrom
      if (dateTo)   filter.due_date.$lte = dateTo
    }

    const skip = (pageNum - 1) * limit
    const [jobs, total] = await Promise.all([
      db.collection('jobs')
        .find(filter)
        .sort({ level1: 1, level2: 1, seq: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('jobs').countDocuments(filter),
    ])

    return NextResponse.json({ jobs, total, page: pageNum, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
