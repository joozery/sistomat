import type { Server } from 'socket.io'
import { buildRealtimeData } from '@/lib/realtime-data'

function getIO(): Server | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (global as any).io ?? null
}

const DEBOUNCE_MS = 2000
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// รวม event ที่ยิงถี่ๆ (worker scan ต่อเนื่อง) ให้คำนวณ + broadcast แค่ครั้งเดียว
// ต่อ client ทุกคนที่เปิดหน้า realtime ค้างไว้ — ไม่ให้แต่ละ client fetch เอง
// เพื่อกัน "thundering herd" ที่ทุก client คำนวณข้อมูลชุดเดียวกันซ้ำพร้อมกัน
export function emitRealtimeUpdate() {
  const io = getIO()
  if (!io) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    buildRealtimeData()
      .then((data) => io.emit('realtime:update', data))
      .catch(() => {})
  }, DEBOUNCE_MS)
}
