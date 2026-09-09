export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)

  if (diffSec < 60) return 'เมื่อครู่นี้'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return 'เมื่อวานนี้'
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`

  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}
