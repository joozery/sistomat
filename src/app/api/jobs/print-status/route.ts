import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? req.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const jobCodes: string[] = Array.isArray(body.job_codes) ? body.job_codes.map((c: any) => String(c).trim()).filter(Boolean) : []
    const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : ''
    const level2 = typeof body.level2 === 'string' ? body.level2.trim() : ''

    const db = (await getClientPromise()).db('sistomat')
    const now = new Date()

    let updatedCount = 0

    if (jobCodes.length > 0) {
      const [resProj, resJobs] = await Promise.all([
        db.collection('projects').updateMany(
          { project_id: { $in: jobCodes } },
          { $set: { is_printed: true, printed_at: now } }
        ),
        db.collection('jobs').updateMany(
          { job_code: { $in: jobCodes } },
          { $set: { is_printed: true, printed_at: now } }
        ),
      ])
      updatedCount = Math.max(resProj.modifiedCount, resJobs.modifiedCount)
    } else if (level2) {
      const [resProj, resJobs] = await Promise.all([
        db.collection('projects').updateMany(
          { level2 },
          { $set: { is_printed: true, printed_at: now } }
        ),
        db.collection('jobs').updateMany(
          { level2 },
          { $set: { is_printed: true, printed_at: now } }
        ),
      ])
      updatedCount = Math.max(resProj.modifiedCount, resJobs.modifiedCount)
    } else if (projectId) {
      const variants = projectId.toUpperCase().startsWith('J')
        ? [projectId]
        : [projectId, `J${projectId}`]
      const [resProj, resJobs] = await Promise.all([
        db.collection('projects').updateMany(
          { level1: { $in: variants }, type: 'job' },
          { $set: { is_printed: true, printed_at: now } }
        ),
        db.collection('jobs').updateMany(
          { level1: { $in: variants } },
          { $set: { is_printed: true, printed_at: now } }
        ),
      ])
      updatedCount = Math.max(resProj.modifiedCount, resJobs.modifiedCount)
    }

    return NextResponse.json({ success: true, updated: updatedCount })
  } catch (error) {
    console.error('POST /api/jobs/print-status error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
