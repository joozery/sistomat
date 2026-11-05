import { isRowCompleted } from './workers'

export const GENERAL_PROCESS_STATUSES = ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จแล้ว'] as const
export const QC_PROCESS_STATUSES = ['รอดำเนินการ', 'กำลังดำเนินการ', 'รอรับงาน', 'รับงาน', 'ไม่รับงาน'] as const

export function isQcProcess(processName: string): boolean {
  return processName.trim().toUpperCase() === 'QC'
}

export function getProcessStatus({
  processName,
  jobStatus,
  workers,
  nextConfirmedAt,
}: {
  processName: string
  jobStatus?: string
  workers?: { worker_id?: string; start_time?: string; stop_time?: string }[]
  nextConfirmedAt?: string | Date | null
}): string {
  const workerLogs = (workers ?? []).map((worker) => ({
    worker_id: String(worker.worker_id ?? ''),
    start_time: String(worker.start_time ?? ''),
    stop_time: String(worker.stop_time ?? ''),
  }))
  const completed = isRowCompleted({
    workers: workerLogs,
    next_confirmed_at: nextConfirmedAt ? String(nextConfirmedAt) : undefined,
  })
  const inProgress = !completed && workerLogs.some((worker) => worker.worker_id && worker.start_time && !worker.stop_time)

  if (!isQcProcess(processName)) {
    if (completed) return 'เสร็จแล้ว'
    if (inProgress) return 'กำลังดำเนินการ'
    return 'รอดำเนินการ'
  }

  if (completed) {
    const normalizedJobStatus = (jobStatus ?? '').trim()
    if (normalizedJobStatus === 'รับงาน' || normalizedJobStatus === 'ไม่รับงาน') return normalizedJobStatus
    return 'รอรับงาน'
  }
  if (inProgress) return 'กำลังดำเนินการ'
  return 'รอดำเนินการ'
}
