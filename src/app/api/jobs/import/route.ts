import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

function hoursToHHMM(hours: number): string {
  if (!hours || isNaN(hours) || hours <= 0) return '00:00'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildProcesses(job: {
  processes: { process: string; person: string; time_hours: number }[]
  outsource_process: string
  coating: string
}): object[] {
  const rows: object[] = []
  let id = 1

  for (const p of job.processes) {
    if (!p.process) continue
    rows.push({
      id: id++,
      process: p.process,
      target_time: hoursToHHMM(p.time_hours),
      skill: '0',
      workers: [
        { worker_id: p.person || '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
      ],
      elapsed_time: '00:00:00',
      remark: '',
    })
  }

  if (job.outsource_process) {
    for (const op of job.outsource_process.split(' / ').filter(Boolean)) {
      rows.push({
        id: id++,
        process: op,
        target_time: '00:00',
        skill: '0',
        workers: [
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
          { worker_id: '', start_time: '', stop_time: '' },
        ],
        elapsed_time: '00:00:00',
        remark: '',
      })
    }
  }

  if (job.coating) {
    rows.push({
      id: id++,
      process: job.coating,
      target_time: '00:00',
      skill: '0',
      workers: [
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
        { worker_id: '', start_time: '', stop_time: '' },
      ],
      elapsed_time: '00:00:00',
      remark: '',
    })
  }

  return rows
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const jobs = await req.json()
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const now = new Date()

    // 1. Upsert into jobs collection (for hierarchy view in job-list page)
    const jobOps = jobs.map((job) => ({
      updateOne: {
        filter: { job_code: job.job_code },
        update: {
          $set: { ...job, updated_at: now },
          $setOnInsert: { created_at: now },
        },
        upsert: true,
      },
    }))
    const jobResult = await db.collection('jobs').bulkWrite(jobOps)

    // 2. Upsert level1 entries into projects collection (appear in main project list)
    const level1Map = new Map<string, { due_date: string; date: string }>()
    for (const job of jobs) {
      if (!job.level1) continue
      const existing = level1Map.get(job.level1)
      const dueDate = job.due_date || ''
      const recDate = job.date || ''
      if (!existing || (dueDate && dueDate < existing.due_date)) {
        level1Map.set(job.level1, { due_date: dueDate, date: recDate })
      }
    }

    const level1Ops = Array.from(level1Map.entries()).map(([level1, info]) => ({
      updateOne: {
        filter: { project_id: level1 },
        update: {
          $set: { project_id: level1, type: 'imported', updated_at: now },
          $setOnInsert: {
            received_date: info.date || now.toISOString().split('T')[0],
            due_date: info.due_date || now.toISOString().split('T')[0],
            status: 'in_progress',
            created_at: now,
          },
        },
        upsert: true,
      },
    }))

    if (level1Ops.length > 0) {
      await db.collection('projects').bulkWrite(level1Ops)
    }

    // 3. Upsert individual job entries into projects collection (for process-details page)
    //    type: 'job' so they are hidden from the main project list
    const jobProjectOps = jobs.map((job) => {
      const processes = buildProcesses(job)
      return {
        updateOne: {
          filter: { project_id: job.job_code },
          update: {
            $set: {
              project_id: job.job_code,
              dwg_name: job.drawing_name,
              due_date: job.due_date || '',
              status: job.status || 'in_progress',
              quantity: job.quantity,
              completed: job.completed,
              remaining: job.remaining,
              sender: job.sender,
              actual_completion_date: job.actual_completion_date || '',
              receiver: job.receiver,
              type: 'job',
              level1: job.level1,
              level2: job.level2,
              level3: job.level3,
              sheet_name: job.sheet_name,
              updated_at: now,
            },
            $setOnInsert: {
              received_date: job.date || now.toISOString().split('T')[0],
              processes,
              created_at: now,
            },
          },
          upsert: true,
        },
      }
    })

    await db.collection('projects').bulkWrite(jobProjectOps)

    return NextResponse.json({
      inserted: jobResult.upsertedCount,
      updated: jobResult.modifiedCount,
      total: jobs.length,
      projects_created: level1Ops.length,
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
