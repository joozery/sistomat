import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import { emitRealtimeUpdate } from '@/lib/socket-server'
import { createNotification } from '@/lib/notify'
import jwt from 'jsonwebtoken'
import { parseJobMarker, type JobMarker } from '@/lib/job-markers'
import { filesFromSnapshots, TRASH_RETENTION_DAYS } from '@/lib/trash'

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

    let quantity = project.quantity
    let isPrinted = project.is_printed
    let printedAt = project.printed_at
    let jobNote = project.job_note
    let receivedDate = project.received_date

    if (quantity == null || isPrinted == null || !jobNote || !receivedDate) {
      const jobDoc = await db.collection('jobs').findOne({ job_code: id }, { projection: { quantity: 1, is_printed: 1, printed_at: 1, job_note: 1, received_date: 1 } })
      if (quantity == null && jobDoc?.quantity != null) {
        quantity = jobDoc.quantity
      }
      if (isPrinted == null && jobDoc?.is_printed != null) {
        isPrinted = jobDoc.is_printed
        printedAt = jobDoc.printed_at
      }
      if (!jobNote && jobDoc?.job_note) {
        jobNote = jobDoc.job_note
      }
      if (!receivedDate && jobDoc?.received_date) {
        receivedDate = jobDoc.received_date
      }
    }

    return NextResponse.json({
      ...project,
      job_note: jobNote,
      quantity,
      is_printed: Boolean(isPrinted),
      printed_at: printedAt,
      received_date: receivedDate,
      _id: project._id.toString()
    })
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
    const marker = body.marker === undefined ? undefined : parseJobMarker(body.marker)
    if (marker === null) return NextResponse.json({ message: 'กรุณาระบุเหตุผล Reject / Rework ไม่เกิน 500 ตัวอักษร' }, { status: 400 })

    const client = await getClientPromise()
    const db = client.db('sistomat')

    if (marker) {
      // Append atomically, retaining previous rounds and unrelated flags.
      // Repeating the same request after a lost response must not add a second round.
      const projects = db.collection<{ project_id: string; marker_history?: JobMarker[]; flags?: Record<string, boolean>; updated_at?: Date }>('projects')
      const updated = await projects.findOneAndUpdate(
        { project_id: id, 'marker_history.id': { $ne: marker.id } },
        { $push: { marker_history: { ...marker, created_at: new Date().toISOString() } },
          $set: { [`flags.has_${marker.type}`]: true, updated_at: new Date() } },
        { returnDocument: 'after', projection: { flags: 1, marker_history: 1 } },
      )
      const result = updated ?? await projects.findOne({ project_id: id }, { projection: { flags: 1, marker_history: 1 } })
      if (!result) return NextResponse.json({ message: 'ไม่พบใบงาน' }, { status: 404 })
      return NextResponse.json({ flags: result.flags, marker_history: result.marker_history })
    }

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
    if (flags !== undefined) {
      // A barcode may update one flag; retain Hold/Rework and other existing flags.
      if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
        return NextResponse.json({ message: 'Invalid flags' }, { status: 400 })
      }
      for (const [key, value] of Object.entries(flags)) {
        if (!/^[a-z_]+$/.test(key) || typeof value !== 'boolean') {
          return NextResponse.json({ message: 'Invalid flags' }, { status: 400 })
        }
        update[`flags.${key}`] = value
      }
    }

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

        if (!wasCompleted && isNowCompleted && isImmediatelyBeforeQc) {
          const completedProcessName = process.process?.trim() || `Process ${index + 1}`

          await createNotification(db, {
            type: 'info',
            category: 'qc',
            title: `งานพร้อมตรวจ QC — ${id}`,
            description: `ใบงาน ${id}${dwgName} จบ Process ${completedProcessName} แล้ว และพร้อมเข้าสู่ ${nextProcessName}`,
            link: `/dashboard/process-details/${id}`,
          }).catch(() => {})
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

    const cleanId = id.trim()
    const variants = Array.from(new Set([
      cleanId,
      cleanId.startsWith('J') ? cleanId : `J${cleanId}`,
      cleanId.replace(/^J(?=[A-Z]-)/, ''),
    ])).filter(Boolean)

    const letterNumberMatch = cleanId.replace(/^J(?=[A-Z]-)/, '').match(/^([A-Z]+)-(\d+)$/)
    if (letterNumberMatch) {
      const prefix = letterNumberMatch[1]
      const num = parseInt(letterNumberMatch[2], 10)
      if (!isNaN(num)) {
        const d3 = String(num).padStart(3, '0')
        const d4 = String(num).padStart(4, '0')
        variants.push(`${prefix}-${d3}`, `J${prefix}-${d3}`)
        variants.push(`${prefix}-${d4}`, `J${prefix}-${d4}`)
      }
    }

    const uniqueVariants = Array.from(new Set(variants)).filter(Boolean)
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const prefixPattern = new RegExp(`^(${uniqueVariants.map(escapeRegExp).join('|')})(-|$)`)

    const [projectDocs, jobDocs] = await Promise.all([
      db.collection('projects').find({
        $or: [
          { project_id: { $in: uniqueVariants } },
          { project_id: { $regex: prefixPattern } },
          { level1: { $in: uniqueVariants } },
          { level2: { $in: uniqueVariants } },
          { level3: { $in: uniqueVariants } },
        ],
      }).toArray(),
      db.collection('jobs').find({
        $or: [
          { job_code: { $in: uniqueVariants } },
          { job_code: { $regex: prefixPattern } },
          { level1: { $in: uniqueVariants } },
          { level2: { $in: uniqueVariants } },
          { level3: { $in: uniqueVariants } },
        ],
      }).toArray(),
    ])

    if (projectDocs.length === 0 && jobDocs.length === 0) {
      return NextResponse.json({ message: `ไม่พบใบงาน "${id}"` }, { status: 404 })
    }

    const deletedAt = new Date()
    const purgeAt = new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const actor = (() => {
      try { return jwt.verify(token, JWT_SECRET) as { username?: string } } catch { return undefined }
    })()
    await db.collection('deleted_projects').insertOne({
      project_id: cleanId,
      projects: projectDocs,
      jobs: jobDocs,
      files: filesFromSnapshots([...projectDocs, ...jobDocs] as Record<string, unknown>[]),
      deleted_at: deletedAt,
      purge_at: purgeAt,
      deleted_by: actor?.username ?? '',
    })
    await Promise.all([
      db.collection('projects').deleteMany({ _id: { $in: projectDocs.map((doc) => doc._id) } }),
      db.collection('jobs').deleteMany({ _id: { $in: jobDocs.map((doc) => doc._id) } }),
    ])

    // notify realtime page clients immediately
    emitRealtimeUpdate()

    return NextResponse.json({ message: 'ลบสำเร็จ' })
  } catch (e) {
    console.error('DELETE /api/projects/[id]:', e)
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
