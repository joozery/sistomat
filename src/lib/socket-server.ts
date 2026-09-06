import type { Server } from 'socket.io'

function getIO(): Server | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (global as any).io ?? null
}

export function emitRealtimeUpdate() {
  getIO()?.emit('realtime:update')
}
