export interface WorkerData {
  code: number
  name: string
  machines: string[]
  username?: string  // login username ในระบบ (ถ้ามี account)
}

export const WORKERS_LIST: WorkerData[] = [
  { code: 0,   name: 'Admin',                       machines: ['ADMIN', 'MAT', 'QC', 'CAM', 'CNC', 'ML', 'LATHE', 'SPAR'], username: 'admin' },
  { code: 335, name: 'นายธณรัฐ การญจนเวทย์',       machines: ['SPAR', 'LATHE 2', 'ML'] },
  { code: 361, name: 'นายอาชวัตร ยิ้มโภชน์',       machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 367, name: 'นายธีระยุทธ บ้านเปี่ยมขวัญ',  machines: ['CNC 1', 'CNC 2'] },
  { code: 395, name: 'น.ส.จิรัชพร ปานอร่ามวงศ์',   machines: ['ADMIN 1', 'MAT'],  username: 'jirachporn' },
  { code: 407, name: 'นายณัฐพงศ์ เปล่งพานิช',      machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 413, name: 'นายอาทิตย์ หุ่นสมบูรณ์',     machines: ['ADMIN 2', 'MAT', 'QC'], username: 'arthit' },
  { code: 417, name: 'นายกิตติคุณ สุขเกษม',        machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 419, name: 'นายจารุเดช ปัทมราช',         machines: ['CNC 4'] },
  { code: 421, name: 'นายพีระพัฒน์ ทับสาร',        machines: ['CNC 3', 'CNC 4'] },
  { code: 451, name: 'น.ส.ณปภัช มโนรส',            machines: ['QC', 'ADMIN 3'],   username: 'napapat' },
  { code: 452, name: 'นายจิรพงษ์ พงศ์ภานิช',       machines: ['CAM 2', 'CNC 3', 'CNC 5'] },
  { code: 453, name: 'นายพัฒนชัย ชูใจ',            machines: ['CAM 1', 'CNC 1', 'CNC 2'] },
]

export function findWorker(code: string): WorkerData | undefined {
  const num = parseInt(code, 10)
  return WORKERS_LIST.find((w) => w.code === num || String(w.code) === code.trim())
}

// หาจาก login username (ตรงตัว) หรือถ้า username เป็นตัวเลข → หาจาก code
export function findWorkerByUsername(username: string): WorkerData | undefined {
  const lower = username.toLowerCase()
  return (
    WORKERS_LIST.find((w) => w.username?.toLowerCase() === lower) ??
    findWorker(username)
  )
}

// ตรวจว่า row นั้นมีคนทำเสร็จแล้ว (stop_time) อย่างน้อย 1 คน
function isRowCompleted(row: { workers: { worker_id: string; start_time: string; stop_time: string }[] }): boolean {
  return row.workers.some((w) => w.worker_id && w.start_time && w.stop_time)
}

// หา row ที่ควรสแกน:
//   1. STOP: ถ้า worker กำลังทำอยู่ → หยุด row นั้นก่อน (ไม่ check sequential)
//   2. START: หา row แรกที่มีสิทธิ์, มีช่องว่าง, และ row ก่อนหน้าทุก row เสร็จแล้ว
//
// คืน { index, blockedByRow } — ถ้า index === -1 + blockedByRow != null = ถูก block โดย sequential
export function findEligibleRowIndex(
  processList: { process: string; workers: { worker_id: string; start_time: string; stop_time: string }[] }[],
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
