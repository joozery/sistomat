import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'
import { getClientPromise } from '@/lib/mongodb'
import { deleteTrashFiles, purgeExpiredTrash } from '@/lib/trash'

function getPayload(req: NextRequest): { role?: string; username?: string } | null {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies.get('auth_token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET!) as { role?: string; username?: string } } catch { return null }
}

function requireSuperadmin(req: NextRequest) {
  const payload = getPayload(req)
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (payload.role?.trim().toLowerCase() !== 'superadmin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const denied = requireSuperadmin(req)
  if (denied) return denied
  const db = (await getClientPromise()).db('sistomat')
  await purgeExpiredTrash(db)
  const items = await db.collection('deleted_projects').find({}).sort({ deleted_at: -1 }).toArray()
  return NextResponse.json(items.map((item) => ({
    _id: item._id.toString(), project_id: item.project_id, deleted_at: item.deleted_at,
    purge_at: item.purge_at, deleted_by: item.deleted_by,
    project_count: item.projects?.length ?? 0, job_count: item.jobs?.length ?? 0, files: item.files ?? [],
  })))
}

export async function POST(req: NextRequest) {
  const denied = requireSuperadmin(req)
  if (denied) return denied
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ message: 'Invalid trash id' }, { status: 400 })
  const db = (await getClientPromise()).db('sistomat')
  await purgeExpiredTrash(db)
  const trash = await db.collection('deleted_projects').findOne({ _id: new ObjectId(id) })
  if (!trash) return NextResponse.json({ message: 'ไม่พบรายการในถังขยะ หรือหมดอายุแล้ว' }, { status: 404 })
  const projects = (trash.projects ?? []) as Record<string, unknown>[]
  const jobs = (trash.jobs ?? []) as Record<string, unknown>[]
  const projectIds = projects.map((doc) => doc.project_id).filter(Boolean)
  const jobCodes = jobs.map((doc) => doc.job_code).filter(Boolean)
  const conflict = await db.collection('projects').findOne({ project_id: { $in: projectIds } })
  const jobConflict = await db.collection('jobs').findOne({ job_code: { $in: jobCodes } })
  if (conflict || jobConflict) return NextResponse.json({ message: 'มีข้อมูลรหัสนี้อยู่ในระบบแล้ว ไม่สามารถกู้คืนซ้ำได้' }, { status: 409 })
  if (projects.length) await db.collection('projects').insertMany(projects)
  if (jobs.length) await db.collection('jobs').insertMany(jobs)
  await db.collection('deleted_projects').deleteOne({ _id: trash._id })
  return NextResponse.json({ message: 'กู้คืนข้อมูลสำเร็จ' })
}

export async function DELETE(req: NextRequest) {
  const denied = requireSuperadmin(req)
  if (denied) return denied
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  const db = (await getClientPromise()).db('sistomat')
  await purgeExpiredTrash(db)
  if (id && !ObjectId.isValid(id)) return NextResponse.json({ message: 'Invalid trash id' }, { status: 400 })
  const filter = id ? { _id: new ObjectId(id) } : { purge_at: { $lte: new Date() } }
  const items = await db.collection('deleted_projects').find(filter).toArray()
  if (items.length === 0) return NextResponse.json({ message: 'ไม่พบรายการที่ลบถาวรได้' }, { status: 404 })
  await Promise.all(items.map((item) => deleteTrashFiles((item.files ?? []) as { file_url: string }[]).catch(() => undefined)))
  await db.collection('deleted_projects').deleteMany({ _id: { $in: items.map((item) => item._id) } })
  return NextResponse.json({ message: 'ลบถาวรสำเร็จ', deleted: items.length })
}
