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

    const result = await db.collection('jobs').aggregate([
      { $unwind: '$processes' },
      { $match: { 'processes.process': { $ne: '', $exists: true } } },
      {
        $group: {
          _id: '$processes.process',
          job_count:        { $sum: 1 },
          total_qty:        { $sum: '$quantity' },
          completed_count:  { $sum: { $cond: [{ $in: ['$status', ['ครบ', 'รับแล้ว']] }, 1, 0] } },
          min_due:          { $min: '$due_date' },
        },
      },
      { $sort: { job_count: -1 } },
      {
        $project: {
          _id: 0,
          process:          '$_id',
          job_count:        1,
          total_qty:        1,
          completed_count:  1,
          min_due:          1,
        },
      },
    ]).toArray()

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
