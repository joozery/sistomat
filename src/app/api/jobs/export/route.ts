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
  workers?: WorkerLog[]
}

interface ProjectDoc {
  project_id: string
  dwg_name?: string
  received_date?: Date | string
  due_date?: Date | string
  status?: string
  processes?: ProcessRow[]
}

interface WorkerDoc {
  code: number | string
  name: string
}

export interface ExportRow {
  job_code: string
  dwg_name: string
  received_date: Date | string | null
  due_date: Date | string | null
  status: string
  index: number
  process: string
  target_time: string
  skill: string
  elapsed_time: string
  workers: string
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
  const status = searchParams.get('status')
  const processFilter = searchParams.get('process')
  const workerFilter = searchParams.get('worker')

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')

    const match: Record<string, unknown> = { processes: { $exists: true, $ne: [] } }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(`${to}T23:59:59.999Z`)
      match.received_date = range
    }
    if (status) match.status = status

    const projects = await db.collection<ProjectDoc>('projects')
      .find(match)
      .project<ProjectDoc>({ project_id: 1, dwg_name: 1, received_date: 1, due_date: 1, status: 1, processes: 1 })
      .sort({ project_id: 1 })
      .toArray()

    const workers = await db.collection<WorkerDoc>('workers').find({}).project<WorkerDoc>({ code: 1, name: 1 }).toArray()
    const nameByCode = new Map(workers.map((w) => [String(w.code), w.name]))

    const rows: ExportRow[] = []
    for (const p of projects) {
      const procs = Array.isArray(p.processes) ? p.processes : []
      procs.forEach((row, i) => {
        if (processFilter && row.process !== processFilter) return
        if (workerFilter && !(row.workers ?? []).some((w) => String(w.worker_id) === workerFilter)) return
        const workerNames = (row.workers ?? [])
          .filter((w) => w.worker_id)
          .map((w) => nameByCode.get(String(w.worker_id)) ?? `#${w.worker_id}`)
        rows.push({
          job_code: p.project_id,
          dwg_name: p.dwg_name ?? '',
          received_date: p.received_date ?? null,
          due_date: p.due_date ?? null,
          status: p.status ?? '',
          index: i + 1,
          process: row.process ?? '',
          target_time: row.target_time ?? '',
          skill: row.skill ?? '',
          elapsed_time: row.elapsed_time ?? '',
          workers: workerNames.join(', '),
        })
      })
    }

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
