import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

interface Attachment {
  file_url: string
  file_name: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? req.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  let role: string
  try {
    role = (jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }).role ?? ''
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (role === 'User' || role === 'ช่าง') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { code } = await params
  const body = await req.json()
  const newCode = typeof body.job_code === 'string' ? body.job_code.trim().toUpperCase() : ''
  const match = newCode.match(/^([A-Z]+-\d{3,4})(?:-(\d{3}))?(?:-(\d{2}))?$/)
  if (!match || (match[3] && !match[2])) {
    return NextResponse.json({ message: 'รูปแบบเลข Job ไม่ถูกต้อง' }, { status: 400 })
  }
  const level1 = match[1]
  const level2 = match[2] ? `${level1}-${match[2]}` : null
  const level3 = match[3] ? newCode : null
  const drawingName = typeof body.drawing_name === 'string' ? body.drawing_name.trim() : ''
  if (!drawingName) return NextResponse.json({ message: 'กรุณากรอกชื่อแบบ' }, { status: 400 })
  const jobNote = typeof body.job_note === 'string' ? body.job_note.trim() : ''
  const quantity = Number(body.quantity)
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return NextResponse.json({ message: 'จำนวนชิ้นงานต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' }, { status: 400 })
  }
  if (!Array.isArray(body.attachments) || body.attachments.some((a: Attachment) =>
    !a || typeof a.file_url !== 'string' || typeof a.file_name !== 'string' || !a.file_url || !a.file_name
  )) {
    return NextResponse.json({ message: 'ข้อมูลไฟล์ไม่ถูกต้อง' }, { status: 400 })
  }

  const attachments = body.attachments as Attachment[]
  const primary = attachments.find((a) => /\.(stl|step|stp|obj|3mf|glb|gltf)$/i.test(a.file_name)) ?? attachments[0]
  const fileUpdate = {
    file_url: primary?.file_url ?? null,
    file_name: primary?.file_name ?? null,
    attachments: attachments.length > 1 ? attachments : null,
    updated_at: new Date(),
  }

  try {
    const db = (await getClientPromise()).db('sistomat')
    const job = await db.collection('jobs').findOne({ job_code: code })
    if (!job) return NextResponse.json({ message: 'ไม่พบ Job' }, { status: 404 })
    const completed = Number(job.completed) || 0
    if (quantity < completed) {
      return NextResponse.json({ message: `จำนวนชิ้นงานต้องไม่น้อยกว่าจำนวนที่เสร็จแล้ว (${completed})` }, { status: 400 })
    }
    if (level1 !== job.level1) {
      return NextResponse.json({ message: 'เปลี่ยนเลข Job ได้เฉพาะภายในโปรเจกต์เดิม' }, { status: 400 })
    }
    if (newCode !== code) {
      const [duplicateJob, duplicateProject] = await Promise.all([
        db.collection('jobs').findOne({ job_code: newCode }),
        db.collection('projects').findOne({ project_id: newCode }),
      ])
      if (duplicateJob || duplicateProject) {
        return NextResponse.json({ message: 'เลข Job นี้มีอยู่แล้ว' }, { status: 409 })
      }
      if (job.level2 && job.level2 !== level2 && await db.collection('quotations').findOne({ code: job.level2 })) {
        return NextResponse.json({ message: 'กลุ่ม Job นี้มีใบเสนอราคาแล้ว จึงเปลี่ยนเลขกลุ่มไม่ได้' }, { status: 409 })
      }
    }

    const projectResult = await db.collection('projects').updateOne(
      { project_id: code, type: 'job' },
      { $set: { ...fileUpdate, project_id: newCode, level1, level2, level3, dwg_name: drawingName, job_note: jobNote, quantity } },
    )
    if (!projectResult.matchedCount) {
      return NextResponse.json({ message: 'ไม่พบใบงานของ Job' }, { status: 404 })
    }
    await db.collection('jobs').updateOne(
      { job_code: code },
      { $set: { ...fileUpdate, job_code: newCode, level1, level2, level3, drawing_name: drawingName, job_note: jobNote, quantity, remaining: quantity - completed } },
    )
    return NextResponse.json({ message: 'บันทึกสำเร็จ' })
  } catch (error) {
    console.error('PATCH /api/jobs/[code]:', error)
    return NextResponse.json({ message: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}
