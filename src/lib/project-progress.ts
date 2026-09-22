import { getEffectiveElapsedSeconds } from './process-time'
import { isRowCompleted } from './workers'

interface ProgressProcess {
  process?: string
  elapsed_time?: string
  next_confirmed_at?: unknown
  workers?: { worker_id?: string; start_time?: string; stop_time?: string }[]
}

// เสร็จจริง = CMD_NEXT แล้ว + มีคนทำจริง (CMD_REJECT ประทับ next_confirmed_at ให้ทุกแถวแม้ไม่เคยเริ่ม)
function isProcessDone(proc: ProgressProcess): boolean {
  return isRowCompleted({
    workers: (proc.workers ?? []).map((w) => ({ worker_id: w.worker_id ?? '', start_time: w.start_time ?? '', stop_time: w.stop_time ?? '' })),
    next_confirmed_at: proc.next_confirmed_at ? String(proc.next_confirmed_at) : undefined,
  })
}

export interface ProgressJob {
  project_id?: string
  dwg_name?: string
  job_note?: string
  status?: string
  processes?: ProgressProcess[]
}

export interface ProjectProgress {
  status: 'none' | 'not_started' | 'in_progress' | 'done'
  current_step: string   // ขั้นตอนที่พบมากสุดในใบงานที่กำลังทำอยู่ ('' ถ้าไม่มี)
  extra_steps: number    // จำนวนขั้นตอนอื่นที่ต่างจาก current_step (แสดงเป็น +N)
  elapsed_seconds: number
  jobs_total: number
  jobs_done: number
  active_steps: { process: string; count: number }[]
  active_jobs: { job_code: string; drawing_name: string; job_note: string; process: string }[]
}

// สรุปความคืบหน้าจากใบงาน (หรือตัวโปรเจกต์เองถ้าไม่มีใบงานลูก)
// process ปัจจุบัน = แถวแรกที่ยังไม่เสร็จ (นิยามเดียวกับ isRowCompleted ที่ใช้บังคับลำดับในหน้า process-details)
export function summarizeProjectProgress(
  jobs: ProgressJob[],
  nowMs = Date.now(),
): ProjectProgress {
  let total = 0
  let done = 0
  let started = 0
  let elapsedSeconds = 0
  const stepCounts = new Map<string, number>()
  const activeJobs: ProjectProgress['active_jobs'] = []

  for (const job of jobs) {
    const processes = job.processes ?? []
    if (processes.length === 0) continue
    if (job.status === 'ยกเลิก') continue  // งานที่ถูก REJECT ไม่นับเป็นงานที่ทำอยู่/เสร็จ
    total++

    for (const proc of processes) elapsedSeconds += getEffectiveElapsedSeconds(proc, nowMs)

    const current = processes.find((proc) => !isProcessDone(proc))
    if (!current) {
      done++
      continue
    }
    const name = (current.process ?? '').trim() || '-'
    stepCounts.set(name, (stepCounts.get(name) ?? 0) + 1)
    if (job.project_id) {
      activeJobs.push({
        job_code: job.project_id,
        drawing_name: job.dwg_name ?? '',
        job_note: job.job_note ?? '',
        process: name,
      })
    }
    if (processes.some((proc) => proc.workers?.some((w) => w.start_time))) {
      started++
    }
  }

  let currentStep = ''
  let topCount = 0
  for (const [name, count] of stepCounts) {
    if (count > topCount) {
      currentStep = name
      topCount = count
    }
  }

  const status: ProjectProgress['status'] =
    total === 0 ? 'none'
    : done === total ? 'done'
    : done + started === 0 ? 'not_started'
    : 'in_progress'

  return {
    status,
    current_step: currentStep,
    extra_steps: Math.max(0, stepCounts.size - 1),
    elapsed_seconds: elapsedSeconds,
    jobs_total: total,
    jobs_done: done,
    active_steps: Array.from(stepCounts, ([process, count]) => ({ process, count }))
      .sort((a, b) => b.count - a.count),
    active_jobs: activeJobs,
  }
}
