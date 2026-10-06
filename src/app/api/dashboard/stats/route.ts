import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getClientPromise } from '@/lib/mongodb'

function getToken(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7) : req.cookies.get('auth_token')?.value
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try { jwt.verify(token, process.env.JWT_SECRET!) } catch { return NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  try {
    const db = (await getClientPromise()).db('sistomat')
    const [result] = await db.collection('projects').aggregate([
      { $match: { type: 'job' } },
      { $group: { _id: null, subjob_count: { $sum: 1 }, piece_count: { $sum: { $ifNull: ['$quantity', 0] } } } },
    ]).toArray()
    return NextResponse.json({ subjob_count: result?.subjob_count ?? 0, piece_count: result?.piece_count ?? 0 })
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error)
    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}
