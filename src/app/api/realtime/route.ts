import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, process.env.JWT_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')

    // ดึงทุก project รวมถึง BU sub-jobs (type: 'job')
    const projects = await db
      .collection('projects')
      .find({})
      .sort({ level1: 1, level2: 1, received_date: -1 })
      .toArray()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []

    for (const proj of projects) {
      const processes: any[] = proj.processes ?? []

      // หา active workers (มี start_time แต่ไม่มี stop_time)
      const activeEntries: any[] = []
      const completedEntries: any[] = []

      for (const proc of processes) {
        const workers: any[] = proc.workers ?? []
        for (const w of workers) {
          if (!w.worker_id || !w.start_time) continue
          const entry = {
            project_id: proj.project_id,
            dwg_name: proj.dwg_name ?? '',
            level1: proj.level1 ?? '',
            level2: proj.level2 ?? '',
            process: proc.process ?? '',
            worker_id: w.worker_id,
            start_time: w.start_time,
            stop_time: w.stop_time ?? null,
            target_time: proc.target_time ?? '',
            skill: proc.skill ?? '0',
            remark: proc.remark ?? '',
            job_status: proj.job_status ?? proj.status ?? '',
            due_date: proj.due_date ?? '',
            received_date: proj.received_date ?? '',
          }
          if (w.stop_time) {
            completedEntries.push({ ...entry, status: 'completed' })
          } else {
            activeEntries.push({ ...entry, status: 'running' })
          }
        }
      }

      if (activeEntries.length > 0 || completedEntries.length > 0) {
        // มี worker บันทึกแล้ว → เพิ่มทุก entry
        events.push(...activeEntries, ...completedEntries)
      } else {
        // ยังไม่มี worker → เพิ่มเป็น idle row (1 row ต่อ project)
        events.push({
          project_id: proj.project_id,
          dwg_name: proj.dwg_name ?? '',
          level1: proj.level1 ?? '',
          level2: proj.level2 ?? '',
          process: processes.map((p) => p.process).filter(Boolean).join(', ') || '—',
          status: 'idle',
          worker_id: '',
          start_time: '',
          stop_time: null,
          target_time: '',
          skill: '0',
          remark: '',
          job_status: proj.job_status ?? proj.status ?? '',
          due_date: proj.due_date ?? '',
          received_date: proj.received_date ?? '',
        })
      }
    }

    // Sort: running → idle → completed
    const order = { running: 0, idle: 1, completed: 2 }
    events.sort((a, b) => {
      const oa = order[a.status as keyof typeof order] ?? 3
      const ob = order[b.status as keyof typeof order] ?? 3
      if (oa !== ob) return oa - ob
      return (b.start_time ?? '').localeCompare(a.start_time ?? '')
    })

    return NextResponse.json({
      events,
      total: events.length,
      running: events.filter((e) => e.status === 'running').length,
      completed: events.filter((e) => e.status === 'completed').length,
      idle: events.filter((e) => e.status === 'idle').length,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
