import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { emitRealtimeUpdate } from '@/lib/socket-server'
import { createNotification } from '@/lib/notify'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

type ProcessSnapshot = {
  process?: string
  next_confirmed_at?: string | Date | null
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { id } = await params
    const client = await getClientPromise()
    const db = client.db('sistomat')

    const project = await db.collection('projects').findOne({ project_id: id })
    if (!project) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    return NextResponse.json({ ...project, _id: project._id.toString() })
  } catch (e) {
    console.error('GET /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { id } = await params
    const body = await req.json()
    const { processes, status, qc, flags } = body

    const client = await getClientPromise()
    const db = client.db('sistomat')

    const before = await db
      .collection('projects')
      .findOne(
        { project_id: id },
        { projection: { dwg_name: 1, processes: 1 } }
      )

    const update: Record<string, unknown> = { updated_at: new Date() }
    if (processes !== undefined) update.processes = processes
    if (status !== undefined) update.status = status
    if (qc !== undefined) update.qc = qc
    if (flags !== undefined) update.flags = flags

    const result = await db
      .collection('projects')
      .updateOne({ project_id: id }, { $set: update })

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    // sync status to jobs collection so job-list page shows latest status
    if (status !== undefined) {
      await db.collection('jobs').updateMany({ job_code: id }, { $set: { status } })
    }

    // notify realtime page clients immediately
    if (processes !== undefined) emitRealtimeUpdate()

    // real notification triggers (fire-and-forget)
    const dwgName = before?.dwg_name ? ` (${before.dwg_name})` : ''

    // Notify only when the process immediately before QC has just been completed.
    // Comparing the stored and submitted timestamps prevents duplicate notifications
    // when the same project data is saved again.
    if (Array.isArray(processes)) {
      const previousProcesses = Array.isArray(before?.processes)
        ? (before.processes as ProcessSnapshot[])
        : []
      const submittedProcesses = processes as ProcessSnapshot[]

      for (const [index, process] of submittedProcesses.entries()) {
        const nextProcessName = submittedProcesses[index + 1]?.process?.trim() ?? ''
        const wasCompleted = Boolean(previousProcesses[index]?.next_confirmed_at)
        const isNowCompleted = Boolean(process.next_confirmed_at)
        const isImmediatelyBeforeQc = /QC/i.test(nextProcessName)

        if (!wasCompleted && isNowCompleted) {
          const completedProcessName = process.process?.trim() || `Process ${index + 1}`

          if (isImmediatelyBeforeQc) {
            await createNotification(db, {
              type: 'info',
              category: 'qc',
              title: `งานพร้อมตรวจ QC — ${id}`,
              description: `ใบงาน ${id}${dwgName} จบ Process ${completedProcessName} แล้ว และพร้อมเข้าสู่ ${nextProcessName}`,
              link: `/dashboard/process-details/${id}`,
            }).catch(() => {})
          } else {
            await createNotification(db, {
              type: 'success',
              category: 'machine',
              title: `กระบวนการเสร็จสิ้น — ${completedProcessName}`,
              description: `ใบงาน ${id}${dwgName} เสร็จสิ้น Process ${completedProcessName} แล้ว`,
              link: `/dashboard/process-details/${id}`,
            }).catch(() => {})
          }
        }
      }
    }

    return NextResponse.json({ message: 'บันทึกสำเร็จ' })
  } catch (e) {
    console.error('PUT /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { id } = await params
    const client = await getClientPromise()
    const db = client.db('sistomat')

    // เผื่อ id เป็น level1 project ที่มี sub-job ผูกอยู่ (เช่น "A-2917" → level1 "JA-2917")
    const childLevel1s = /^J[A-Z]-\d{3,4}$/.test(id) ? [id] : [id, `J${id}`]
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // fallback ด้วย project_id prefix เผื่อ projects doc เก่าที่ไม่มี field level1 (สร้างผ่าน /api/jobs ก่อนหน้านี้)
    const level1PrefixPattern = new RegExp(`^(${childLevel1s.map(escapeRegExp).join('|')})-`)

    const [projectResult] = await Promise.all([
      db.collection('projects').deleteOne({ project_id: id }),
      db.collection('projects').deleteMany({
        $or: [{ level1: { $in: childLevel1s } }, { project_id: { $regex: level1PrefixPattern } }],
      }),
      db.collection('jobs').deleteMany({ level1: { $in: childLevel1s } }),
      // เผื่อ id เป็น job_code เดี่ยว (เช่น "JA-8888-001-01") ไม่ใช่ level1 root —
      // ลบ entry ใน jobs collection ที่ตรงกันด้วย ไม่งั้นจะเหลือค้างให้เห็นในหน้า job-list
      db.collection('jobs').deleteOne({ job_code: id }),
    ])

    if (projectResult.deletedCount === 0) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    // notify realtime page clients immediately
    emitRealtimeUpdate()

    return NextResponse.json({ message: 'ลบสำเร็จ' })
  } catch (e) {
    console.error('DELETE /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
