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

    // aggregate จาก projects collection — source of truth สำหรับ next_confirmed_at
    const result = await db.collection('projects').aggregate([
      // กระจาย processes array
      { $unwind: '$processes' },
      // กรองชื่อ process ที่ว่างหรือเป็น placeholder
      {
        $match: {
          'processes.process': { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$processes.process',
          // จำนวน project ที่มี process นี้
          job_count: { $sum: 1 },
          // รวม quantity จาก project (ถ้ามี)
          total_qty: { $sum: { $ifNull: ['$quantity', 1] } },
          // นับว่ากระบวนการนี้ยืนยันแล้ว (CMD_NEXT) กี่ครั้ง
          completed_count: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$processes.next_confirmed_at', null] }, null] }, 1, 0],
            },
          },
          // กำหนดส่งที่ใกล้ที่สุดของ project ที่มี process นี้
          min_due: { $min: '$due_date' },
        },
      },
      { $sort: { job_count: -1 } },
      {
        $project: {
          _id: 0,
          process: '$_id',
          job_count: 1,
          total_qty: 1,
          completed_count: 1,
          min_due: 1,
        },
      },
    ]).toArray()

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
