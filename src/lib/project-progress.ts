import { getEffectiveElapsedSeconds } from './process-time'
import { isRowCompleted } from './workers'

interface ProgressProcess {
  process?: string
  target_time?: string
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

function parseTargetSeconds(raw?: string): number {
  const value = (raw ?? '').trim()
  if (!value) return 0
  if (value.includes(':')) {
    const [hours = '', minutes = ''] = value.split(':')
    return (Number(hours.replace(/\D/g, '')) || 0) * 3600 + (Number(minutes.replace(/\D/g, '')) || 0) * 60
  }
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return (Number(digits) || 0) * 3600
  return (Number(digits.slice(0, -2)) || 0) * 3600 + (Number(digits.slice(-2)) || 0) * 60
}

export interface ProgressJob {
  project_id?: string
  dwg_name?: string
  job_note?: string
  status?: string
  quantity?: number
  is_printed?: boolean
  processes?: ProgressProcess[]
}

export function isClosedJobStatus(status?: string): boolean {
  const normalized = (status ?? '').trim()
  return normalized === 'ยกเลิกงาน' || normalized === 'ยกเลิก'
}

export interface ProjectProgress {
  status: 'none' | 'not_started' | 'in_progress' | 'done'
  current_step: string   // ขั้นตอนที่พบมากสุดในใบงานที่กำลังทำอยู่ ('' ถ้าไม่มี)
  extra_steps: number    // จำนวนขั้นตอนอื่นที่ต่างจาก current_step (แสดงเป็น +N)
  elapsed_seconds: number
  jobs_total: number
  jobs_done: number
  jobs_printed: number
  jobs_pending_process: number
  active_steps: { process: string; count: number; target_seconds: number; pieces: number }[]
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
  let printed = 0
  let pendingProcess = 0
  let elapsedSeconds = 0
  const stepCounts = new Map<string, { count: number; target_seconds: number; pieces: number }>()
  const activeJobs: ProjectProgress['active_jobs'] = []

  for (const job of jobs) {
    // งานที่ปิด/ยกเลิกแล้วไม่นับเป็นงานที่ทำอยู่หรือรอเพิ่ม Process
    // ปุ่ม "ปิดงาน" บันทึกสถานะเป็น "ยกเลิกงาน" ส่วนข้อมูลเก่าบางรายการใช้ "ยกเลิก"
    if (isClosedJobStatus(job.status)) continue

    const processes = job.processes ?? []
    const validProcesses = processes.filter((p) => p && typeof p.process === 'string' && p.process.trim().length > 0)

    total++
    if (job.is_printed) printed++

    if (validProcesses.length === 0) {
      pendingProcess++
      continue
    }

    for (const proc of validProcesses) elapsedSeconds += getEffectiveElapsedSeconds(proc, nowMs)

    const current = validProcesses.find((proc) => !isProcessDone(proc))
    if (!current) {
      done++
      continue
    }
    const name = (current.process ?? '').trim() || '-'
    const currentSummary = stepCounts.get(name) ?? { count: 0, target_seconds: 0, pieces: 0 }
    currentSummary.count += 1
    currentSummary.target_seconds += parseTargetSeconds(current.target_time)
    currentSummary.pieces += Number.isFinite(Number(job.quantity)) && Number(job.quantity) > 0 ? Number(job.quantity) : 1
    stepCounts.set(name, currentSummary)
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
  for (const [name, summary] of stepCounts) {
    if (summary.count > topCount) {
      currentStep = name
      topCount = summary.count
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
    jobs_printed: printed,
    jobs_pending_process: pendingProcess,
    active_steps: Array.from(stepCounts, ([process, summary]) => ({ process, ...summary }))
      .sort((a, b) => b.count - a.count),
    active_jobs: activeJobs,
  }
}
