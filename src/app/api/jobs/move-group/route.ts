import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function PUT(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }
    const role = String(payload.role ?? '').trim().toLowerCase()
    if (role === 'user' || role === 'ช่าง') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as { from_group?: unknown; to_group?: unknown }
    const fromGroup = typeof body.from_group === 'string' ? body.from_group.trim().toUpperCase() : ''
    const toGroup = typeof body.to_group === 'string' ? body.to_group.trim().toUpperCase() : ''
    const codePattern = /^([A-Z]+-\d{3,4})-(\d{3})$/
    const fromMatch = fromGroup.match(codePattern)
    const toMatch = toGroup.match(codePattern)
    if (!fromMatch || !toMatch) {
      return NextResponse.json({ error: 'รูปแบบเลขกลุ่ม Job ไม่ถูกต้อง' }, { status: 400 })
    }
    if (fromGroup === toGroup) {
      return NextResponse.json({ error: 'เลขกลุ่มใหม่ต้องแตกต่างจากเลขกลุ่มเดิม' }, { status: 400 })
    }
    if (fromMatch[1] !== toMatch[1]) {
      return NextResponse.json({ error: 'เปลี่ยนกลุ่มได้เฉพาะภายใน Job ใหญ่เดิม' }, { status: 400 })
    }

    const db = (await getClientPromise()).db('sistomat')
    const [jobs, projects, oldQuotation, targetQuotation] = await Promise.all([
      db.collection<{ job_code: string; level3?: string }>('jobs').find({ level2: fromGroup }).project({ job_code: 1, level3: 1 }).toArray(),
      db.collection<{ project_id: string; level3?: string }>('projects').find({ level2: fromGroup, type: 'job' }).project({ project_id: 1, level3: 1 }).toArray(),
      db.collection('quotations').findOne({ code: fromGroup }),
      db.collection('quotations').findOne({ code: toGroup }, { projection: { code: 1 } }),
    ])
    if (jobs.length === 0 || projects.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Job ลูกของกลุ่มนี้' }, { status: 404 })
    }
    if (targetQuotation) {
      return NextResponse.json({ error: 'กลุ่มปลายทางมีใบเสนอราคาอยู่แล้ว' }, { status: 409 })
    }

    const oldPrefix = `${fromGroup}-`
    const newPrefix = `${toGroup}-`
    const nextCode = (code: string) => code.startsWith(oldPrefix) ? `${newPrefix}${code.slice(oldPrefix.length)}` : code
    const targetJobCodes = jobs.map((job) => nextCode(job.job_code))
    const targetProjectIds = projects.map((project) => nextCode(project.project_id))
    const [jobConflict, projectConflict] = await Promise.all([
      db.collection('jobs').findOne({ job_code: { $in: targetJobCodes } }),
      db.collection('projects').findOne({ project_id: { $in: targetProjectIds } }),
    ])
    if (jobConflict || projectConflict) {
      return NextResponse.json({ error: 'เลข Job ปลายทางมีข้อมูลอยู่แล้ว' }, { status: 409 })
    }

    const now = new Date()
    await db.collection('jobs').bulkWrite(jobs.map((job) => ({
      updateOne: {
        filter: { job_code: job.job_code, level2: fromGroup },
        update: { $set: { job_code: nextCode(job.job_code), level2: toGroup, level3: job.level3 ? nextCode(job.level3) : job.level3, updated_at: now } },
      },
    })))
    await db.collection('projects').bulkWrite(projects.map((project) => ({
      updateOne: {
        filter: { project_id: project.project_id, level2: fromGroup, type: 'job' },
        update: { $set: { project_id: nextCode(project.project_id), level2: toGroup, level3: project.level3 ? nextCode(project.level3) : project.level3, updated_at: now } },
      },
    })))
    if (oldQuotation) {
      await db.collection('quotations').updateOne({ code: fromGroup }, { $set: { code: toGroup, updated_at: now } })
    }

    return NextResponse.json({
      message: 'เปลี่ยนกลุ่ม Job สำเร็จ',
      from_group: fromGroup,
      to_group: toGroup,
      jobs_updated: jobs.length,
      projects_updated: projects.length,
      quotation_updated: Boolean(oldQuotation),
    })
  } catch (error) {
    console.error('PUT /api/jobs/move-group:', error)
    return NextResponse.json({ error: 'เปลี่ยนกลุ่ม Job ไม่สำเร็จ' }, { status: 500 })
  }
}
