import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

type UpdateRow = {
  job_code?: unknown
  drawing_name?: unknown
  sender?: unknown
  quantity?: unknown
  received_date?: unknown
  due_date?: unknown
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string') return null
  const date = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let role = ''
  try {
    role = String((jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }).role ?? '')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (role === 'User' || role === 'ช่าง') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขข้อมูล Job' }, { status: 403 })
  }

  try {
    const body = await req.json() as { parent_id?: unknown; level2_codes?: unknown; rows?: unknown }
    const parentId = typeof body.parent_id === 'string' ? body.parent_id.trim().toUpperCase() : ''
    const level2Codes = Array.isArray(body.level2_codes)
      ? new Set(body.level2_codes.filter((value): value is string => typeof value === 'string').map((value) => value.trim().toUpperCase()))
      : new Set<string>()
    const rows = Array.isArray(body.rows) ? body.rows as UpdateRow[] : []
    if (!parentId || level2Codes.size === 0 || rows.length === 0 || rows.length > 1000) {
      return NextResponse.json({ error: 'ข้อมูลนำเข้าไม่ถูกต้อง' }, { status: 400 })
    }

    const cleaned = rows.map((row, index) => {
      const jobCode = typeof row.job_code === 'string' ? row.job_code.trim().toUpperCase() : ''
      const drawingName = typeof row.drawing_name === 'string' ? row.drawing_name.trim() : ''
      const sender = typeof row.sender === 'string' ? row.sender.trim() : ''
      const quantity = Number(row.quantity)
      const receivedDate = normalizeDate(row.received_date)
      const dueDate = normalizeDate(row.due_date)
      if (!jobCode || !drawingName || !Number.isSafeInteger(quantity) || quantity < 1 || receivedDate === null || dueDate === null) {
        throw new Error(`แถวที่ ${index + 2} มีข้อมูลไม่ถูกต้อง`)
      }
      return { jobCode, drawingName, sender, quantity, receivedDate, dueDate }
    })

    const codes = cleaned.map((row) => row.jobCode)
    if (new Set(codes).size !== codes.length) {
      return NextResponse.json({ error: 'พบเลข Job ซ้ำในไฟล์' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const jobs = await db.collection('jobs').find({ job_code: { $in: codes } }).project({ job_code: 1, drawing_name: 1, level1: 1, level2: 1 }).toArray()
    const expectedLevel1 = new Set([parentId, parentId.startsWith('J') ? parentId.slice(1) : `J${parentId}`])
    const byCode = new Map(jobs.map((job) => [String(job.job_code).toUpperCase(), job]))
    const errors: string[] = []
    for (const row of cleaned) {
      const existing = byCode.get(row.jobCode)
      if (!existing) errors.push(`${row.jobCode}: ไม่พบ Job ในระบบ`)
      else if (!expectedLevel1.has(String(existing.level1 ?? '').toUpperCase())) errors.push(`${row.jobCode}: ไม่อยู่ในกลุ่ม ${parentId}`)
      else if (!level2Codes.has(String(existing.level2 ?? existing.job_code ?? '').toUpperCase())) errors.push(`${row.jobCode}: ไม่อยู่ในกลุ่ม Level 2 ที่เลือก`)
      else if (String(existing.drawing_name ?? '').trim() !== row.drawingName) errors.push(`${row.jobCode}: ชื่อแบบไม่ตรงกับข้อมูลเดิม`)
    }
    if (errors.length > 0) return NextResponse.json({ error: errors.slice(0, 10).join('\n') }, { status: 400 })

    const now = new Date()
    const jobOps = cleaned.map((row) => ({
      updateOne: {
        filter: { job_code: row.jobCode },
        update: { $set: { sender: row.sender, quantity: row.quantity, received_date: row.receivedDate, due_date: row.dueDate, updated_at: now } },
      },
    }))
    const projectOps = cleaned.map((row) => ({
      updateOne: {
        filter: { project_id: row.jobCode },
        update: { $set: { sender: row.sender, quantity: row.quantity, received_date: row.receivedDate, due_date: row.dueDate, updated_at: now } },
      },
    }))
    await db.collection('jobs').bulkWrite(jobOps)
    await db.collection('projects').bulkWrite(projectOps)
    return NextResponse.json({ updated: cleaned.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
