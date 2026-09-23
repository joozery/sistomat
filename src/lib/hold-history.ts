export interface HoldEntry {
  reason: string
  held_at: string | null
  released_at: string | null
}

interface HoldState {
  on_hold?: boolean
  hold_reason?: string
  hold_history?: HoldEntry[]
  next_confirmed_at?: string
}

export function getHoldHistory(row: HoldState): HoldEntry[] {
  if (row.hold_history?.length) return row.hold_history
  // Retain the one reason available in legacy records without inventing dates.
  if (row.hold_reason || row.on_hold !== undefined) {
    return [{ reason: row.hold_reason || '', held_at: null, released_at: null }]
  }
  return []
}

export function updateHoldHistory(row: HoldState, reason: string | null, now: string): HoldEntry[] {
  const history = getHoldHistory(row).map(entry => ({ ...entry }))
  if (reason !== null) {
    if (!reason.trim()) throw new Error('กรุณาระบุเหตุผลในการ HOLD')
    if (row.on_hold) throw new Error('กระบวนการนี้กำลัง HOLD อยู่แล้ว')
    history.push({ reason: reason.trim(), held_at: now, released_at: null })
  } else {
    if (!row.on_hold) throw new Error('กระบวนการนี้ไม่ได้อยู่ในสถานะ HOLD')
    const current = history[history.length - 1]
    current.released_at = now
  }
  return history
}

export function getPastHolds(row: HoldState) {
  const history = getHoldHistory(row)
  return history.map((entry, index) => ({ ...entry, round: index + 1 }))
    .filter((_, index) => !(row.on_hold && !row.next_confirmed_at && index === history.length - 1))
}
