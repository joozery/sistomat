import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

interface WorkerLog {
  worker_id: string
  start_time: string
  stop_time: string
}

interface ProcessRow {
  process?: string
  target_time?: string
  skill?: string
  elapsed_time?: string
  damage_cost?: string | number
  remark?: string
  workers?: WorkerLog[]
  next_confirmed_at?: string | Date | null
}

interface ProjectDoc {
  project_id: string
  job_note?: string
  dwg_name?: string
  sender?: string
  quantity?: number | string
  received_date?: Date | string
  due_date?: Date | string
  status?: string
  processes?: ProcessRow[]
  coating?: string
}

interface WorkerDoc {
  code: number | string
  name: string
}

export interface ExportRow {
  job_code: string
  job_note?: string
  dwg_name: string
  sender: string
  quantity: number
  received_date: Date | string | null
  due_date: Date | string | null
  status: string
  index: number
  process: string
  target_time: string
  skill: string
  elapsed_time: string
  damage_cost: number
  remark: string
  workers: string
  completed: boolean
  coating: string
}

function compareJobCodes(a: string, b: string) {
  const aParts = a.match(/[A-Za-z]+|\d+/g) ?? [a]
  const bParts = b.match(/[A-Za-z]+|\d+/g) ?? [b]
  const length = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < length; i += 1) {
    const left = aParts[i] ?? ''
    const right = bParts[i] ?? ''
    const leftNumber = /^\d+$/.test(left)
    const rightNumber = /^\d+$/.test(right)
    if (leftNumber && rightNumber) {
      const difference = Number(left) - Number(right)
      if (difference !== 0) return difference
    } else {
      const difference = left.localeCompare(right, undefined, { sensitivity: 'base' })
      if (difference !== 0) return difference
    }
  }
  return 0
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const dateField = searchParams.get('dateField') === 'due' ? 'due_date' : 'received_date'
  const job = searchParams.get('job')?.trim()
  const status = searchParams.get('status')
  const processFilter = searchParams.get('process')
  const workerFilter = searchParams.get('worker')

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')

    const match: Record<string, unknown> = { processes: { $exists: true, $ne: [] } }
    if (from || to) {
      const dateAsDate = { $convert: { input: `$${dateField}`, to: 'date', onError: null, onNull: null } }
      const dateConditions: Record<string, unknown>[] = [{ $ne: [dateAsDate, null] }]
      if (from) dateConditions.push({ $gte: [dateAsDate, new Date(`${from}T00:00:00.000Z`)] })
      if (to) dateConditions.push({ $lte: [dateAsDate, new Date(`${to}T23:59:59.999Z`)] })
      match.$expr = { $and: dateConditions }
    }
    if (status) match.status = status
    if (job) {
      const escaped = job.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      match.$or = [
        { project_id: { $regex: escaped, $options: 'i' } },
        { job_note: { $regex: escaped, $options: 'i' } },
      ]
    }

    const projects = await db.collection<ProjectDoc>('projects')
      .find(match)
      .project<ProjectDoc>({ project_id: 1, job_note: 1, dwg_name: 1, sender: 1, quantity: 1, received_date: 1, due_date: 1, status: 1, processes: 1, coating: 1 })
      .toArray()

    projects.sort((a, b) => compareJobCodes(String(a.project_id), String(b.project_id)))

    // รวบรวมรหัสโปรเจกต์หลักที่ยังคงมีอยู่จริงในระบบ เพื่อคัดกรองไม่ให้ Job กำพร้าที่ถูกลบไปแล้วหลุดมาแสดง
    const activeParents = await db
      .collection('projects')
      .find({ type: { $ne: 'job' } })
      .project({ project_id: 1 })
      .toArray()
    const activeParentCodes = new Set<string>()
    for (const ap of activeParents) {
      if (ap.project_id) {
        const clean = String(ap.project_id).trim()
        activeParentCodes.add(clean)
        activeParentCodes.add(`J${clean}`)
        activeParentCodes.add(clean.replace(/^J(?=[A-Z]-)/, ''))
      }
    }

    const workers = await db.collection<WorkerDoc>('workers').find({}).project<WorkerDoc>({ code: 1, name: 1 }).toArray()
    const nameByCode = new Map(workers.map((w) => [String(w.code), w.name]))

    const rows: ExportRow[] = []
    for (const p of projects) {
      // คัดกรองเฉพาะ Job ที่โปรเจกต์หลักยังคงมีอยู่ในระบบ
      const level1 = p.project_id.split('-').slice(0, 2).join('-')
      const level1Clean = level1.replace(/^J(?=[A-Z]-)/, '')
      if (
        activeParentCodes.size > 0 &&
        !activeParentCodes.has(level1) &&
        !activeParentCodes.has(level1Clean) &&
        !activeParentCodes.has(p.project_id)
      ) {
        continue
      }

      const note = typeof p.job_note === 'string' ? p.job_note.trim() : ''
      const fullJobCode = [p.project_id, note].filter(Boolean).join('-')
      const parsedQty = Number(p.quantity)
      const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1

      const procs = Array.isArray(p.processes) ? p.processes : []
      procs.forEach((row, i) => {
        if (processFilter && row.process !== processFilter) return
        if (workerFilter && !(row.workers ?? []).some((w) => String(w.worker_id) === workerFilter)) return
        const workerNames = (row.workers ?? [])
          .filter((w) => w.worker_id)
          .map((w) => nameByCode.get(String(w.worker_id)) ?? `#${w.worker_id}`)
        rows.push({
          job_code: fullJobCode,
          job_note: note,
          dwg_name: p.dwg_name ?? '',
          sender: p.sender ?? '',
          quantity,
          received_date: p.received_date ?? null,
          due_date: p.due_date ?? null,
          status: p.status ?? '',
          index: i + 1,
          process: row.process ?? '',
          target_time: row.target_time ?? '',
          skill: row.skill ?? '',
          elapsed_time: row.elapsed_time ?? '',
          damage_cost: Number.isFinite(Number(row.damage_cost)) ? Math.max(0, Number(row.damage_cost)) : 0,
          remark: row.remark ?? '',
          workers: workerNames.join(', '),
          completed: Boolean(row.next_confirmed_at),
          coating: p.coating ?? '',
        })
      })
    }

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
