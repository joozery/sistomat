export interface WorkerData {
  code: number
  name: string
  machines: string[]
  username?: string  // login username ในระบบ (ถ้ามี account)
}

// รายชื่อพนักงานและสิทธิ์เครื่องจักรมาจาก DB (collection `workers`) ผ่าน
// GET /api/workers และแก้ไขได้ที่หน้า /dashboard/user-management
export function findWorker(code: string, list: WorkerData[]): WorkerData | undefined {
  const num = parseInt(code, 10)
  return list.find((w) => w.code === num || String(w.code) === code.trim())
}

// หาจาก login username (ตรงตัว) หรือถ้า username เป็นตัวเลข → หาจาก code
export function findWorkerByUsername(username: string, list: WorkerData[]): WorkerData | undefined {
  const lower = username.toLowerCase()
  return (
    list.find((w) => w.username?.toLowerCase() === lower) ??
    findWorker(username, list)
  )
}

// row จบแล้ว = ต้องสแกน CMD_NEXT ยืนยัน + มีคนเสร็จอย่างน้อย 1 คน + ไม่มีใครยังวิ่งอยู่
export function isRowCompleted(row: { workers: { worker_id: string; start_time: string; stop_time: string }[]; next_confirmed_at?: string }): boolean {
  if (!row.next_confirmed_at) return false
  const hasCompleted = row.workers.some((w) => w.worker_id && w.start_time && w.stop_time)
  const hasRunning   = row.workers.some((w) => w.worker_id && w.start_time && !w.stop_time)
  return hasCompleted && !hasRunning
}

// หา row ที่ควรสแกน:
//   1. STOP: ถ้า worker กำลังทำอยู่ → หยุด row นั้นก่อน (ไม่ check sequential)
//   2. START: หา row แรกที่มีสิทธิ์, มีช่องว่าง, และ row ก่อนหน้าทุก row เสร็จแล้ว
//
// คืน { index, blockedByRow } — ถ้า index === -1 + blockedByRow != null = ถูก block โดย sequential
export function findEligibleRowIndex(
  processList: { process: string; workers: { worker_id: string; start_time: string; stop_time: string }[]; next_confirmed_at?: string }[],
  workerCode: string,
  machines: string[],
): { index: number; blockedByRow: number | null } {
  // STOP: หา row ที่ worker กำลัง running (ไม่เช็ค sequential — ให้หยุดงานได้เสมอ)
  const running = processList.findIndex((row) =>
    row.workers.some((w) => w.worker_id === workerCode && w.start_time && !w.stop_time)
  )
  if (running !== -1) return { index: running, blockedByRow: null }

  // START: หา row แรกที่มีสิทธิ์และมีช่องว่าง โดยบังคับลำดับ
  for (let i = 0; i < processList.length; i++) {
    const row = processList[i]
    if (isRowCompleted(row)) continue  // ข้าม row ที่ CMD_NEXT ปิดไปแล้ว
    if (!canWorkerDoProcess(machines, row.process)) continue
    if (!row.workers.some((w) => !w.worker_id)) continue

    // ตรวจ row ก่อนหน้าทุก row ต้องเสร็จแล้ว
    const blockingRow = processList.slice(0, i).findIndex((prev) => !isRowCompleted(prev))
    if (blockingRow !== -1) {
      // row นี้ถูก block — แต่ยังเช็ค row ถัดไปต่อไม่ได้เพราะ sequential
      return { index: -1, blockedByRow: blockingRow }
    }

    return { index: i, blockedByRow: null }
  }

  return { index: -1, blockedByRow: null }
}

function getRequiredMachine(processName: string): string | null {
  const p = processName.toUpperCase()
  if (p.includes('MAT'))              return 'MAT'
  if (p.includes('QC'))               return 'QC'
  if (p.includes('CAM'))              return 'CAM'
  if (p.includes('CNC') || p.includes('SPAR')) return 'CNC'
  if (p === 'ML')                     return 'ML'
  if (p.includes('LATHE'))            return 'LATHE'
  return null // ไม่มี constraint — ทุกคนทำได้
}

export function canWorkerDoProcess(machines: string[], processName: string): boolean {
  const required = getRequiredMachine(processName)
  if (!required) return true
  if (machines.some((m) => m.toUpperCase().includes('ADMIN'))) return true
  return machines.some((m) => m.toUpperCase().includes(required))
}
