interface ProcessWorkerTime {
  start_time?: string
  stop_time?: string
}

interface ProcessTimeData {
  elapsed_time?: string
  workers?: ProcessWorkerTime[]
}

export function parseElapsedSeconds(value = ''): number {
  if (!value || value === '00:00:00' || value === '00:00') return 0
  const parts = value.split(':').map(Number)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60
  return 0
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseWorkerTime(value: string, referenceMs: number): number {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value.replace(' ', 'T')).getTime()
  }

  const now = new Date(referenceMs)
  let result = new Date(`${localDateString(now)}T${value}`).getTime()
  if (Number.isNaN(result)) return Number.NaN

  if (result > referenceMs + 60_000) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    result = new Date(`${localDateString(yesterday)}T${value}`).getTime()
  }
  return result
}

// elapsed_time ในฐานข้อมูลอาจยังไม่อัปเดตขณะงานกำลังเดินอยู่ จึงคำนวณ
// จาก worker sessions ด้วย และเลือกค่าที่มากกว่าเพื่อไม่ให้นับเวลาซ้ำ
export function getEffectiveElapsedSeconds(process: ProcessTimeData, nowMs = Date.now()): number {
  const storedSeconds = parseElapsedSeconds(process.elapsed_time)
  let workerSeconds = 0

  for (const worker of process.workers ?? []) {
    if (!worker.start_time) continue
    const start = parseWorkerTime(worker.start_time, nowMs)
    const stop = worker.stop_time ? parseWorkerTime(worker.stop_time, nowMs) : nowMs
    if (!Number.isNaN(start) && !Number.isNaN(stop) && stop > start) {
      workerSeconds += Math.floor((stop - start) / 1000)
    }
  }

  return Math.max(storedSeconds, workerSeconds)
}
