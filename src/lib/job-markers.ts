export type JobMarkerType = 'reject' | 'rework'
export interface JobMarker {
  id: string
  type: JobMarkerType
  reason: string
  created_at: string
}

export function parseJobMarker(value: unknown): Omit<JobMarker, 'created_at'> | null {
  if (!value || typeof value !== 'object') return null
  const marker = value as Record<string, unknown>
  if (marker.type !== 'reject' && marker.type !== 'rework') return null
  if (typeof marker.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(marker.id)) return null
  if (typeof marker.reason !== 'string' || !marker.reason.trim() || marker.reason.trim().length > 500) return null
  return { id: marker.id, type: marker.type, reason: marker.reason.trim() }
}
