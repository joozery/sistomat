export function normalizeBuCode(code: string): string {
  const upper = code.trim().toUpperCase()
  return /^[A-Z]-/.test(upper) && !upper.startsWith('J') ? `J${upper}` : upper
}

interface BuNumberRow {
  id: string
  jobCode: string
  level3: string
  level3Touched: boolean
}

// Only the first row of a group controls its sequence. Incomplete input is
// retained while typing; other groups are never renumbered.
export function changeBuCode<T extends BuNumberRow>(rows: T[], id: string, value: string, existingCodes: string[]): T[] {
  const index = rows.findIndex(row => row.id === id)
  if (index < 0) return rows
  const updated = rows.map(row => row.id === id ? { ...row, level3: value, level3Touched: true } : row)
  const base = normalizeBuCode(rows[index].jobCode)
  const code = normalizeBuCode(value)
  if (rows.slice(0, index).some(row => normalizeBuCode(row.jobCode) === base)) return updated
  if (!code.startsWith(`${base}-`)) return updated
  const suffix = code.slice(base.length + 1)
  if (!/^\d{2}$/.test(suffix) || Number(suffix) < 1) return updated
  const used = new Set(existingCodes.map(normalizeBuCode))
  let next = Number(suffix)
  return updated.map(row => {
    if (normalizeBuCode(row.jobCode) !== base) return row
    while (used.has(`${base}-${String(next).padStart(2, '0')}`)) next++
    const level3 = `${base}-${String(next++).padStart(2, '0')}`
    used.add(level3)
    return { ...row, level3, level3Touched: row.id === id }
  })
}

export function validateBuCodes(rows: BuNumberRow[], existingCodes: string[]): string {
  const used = new Set(existingCodes.map(normalizeBuCode))
  for (const row of rows) {
    const code = normalizeBuCode(row.level3 || row.jobCode)
    if (row.level3.trim() && (!/^[A-Z]+-\d{3,4}-\d{3}-\d{2}$/.test(code) || code.endsWith('-00') || !code.startsWith(`${normalizeBuCode(row.jobCode)}-`))) {
      return `เลข BU ไม่ถูกต้อง: ${code} กรุณาใช้เลข 01–99 ภายใต้ Job ของแถวนี้`
    }
    if (used.has(code)) return `เลข ${code} มีอยู่แล้ว กรุณาเปลี่ยนเลข BU`
    used.add(code)
  }
  return ''
}

export function assignBuCodes<T extends BuNumberRow>(rows: T[], existingCodes: string[]): T[] {
  let result = rows
  const groups = new Set(rows.map(row => normalizeBuCode(row.jobCode)).filter(Boolean))
  for (const base of groups) {
    const first = result.find(row => normalizeBuCode(row.jobCode) === base)!
    if (!/^[A-Z]+-\d{3,4}-\d{3}$/.test(base)) continue
    const suffixes = existingCodes.map(normalizeBuCode)
      .filter(code => code.startsWith(`${base}-`) && /^\d{2}$/.test(code.slice(base.length + 1)))
      .map(code => Number(code.slice(base.length + 1)))
    const start = Math.max(0, ...suffixes) + 1
    const seed = first.level3Touched && normalizeBuCode(first.level3).startsWith(`${base}-`)
      ? first.level3 : `${base}-${String(start).padStart(2, '0')}`
    result = changeBuCode(result, first.id, seed, existingCodes)
      .map(row => row.id === first.id ? { ...row, level3Touched: first.level3Touched } : row)
  }
  return result
}

export interface ExistingBuJob { job_code: string; level2?: string | null; sale_closed_at?: string | null }

export async function fetchBuJobs(parent: string, token: string | null): Promise<ExistingBuJob[]> {
  const normalized = normalizeBuCode(parent)
  const variants = Array.from(new Set([parent, normalized, normalized.replace(/^J(?=[A-Z]-)/, '')]))
  const lists = await Promise.all(variants.map(async level1 => {
    const jobs: ExistingBuJob[] = []
    for (let page = 1; ; page++) {
      const res = await fetch(`/api/jobs?level1=${encodeURIComponent(level1)}&limit=200&page=${page}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('โหลดเลข BU เดิมไม่สำเร็จ กรุณาลองอีกครั้ง')
      const data = await res.json()
      const batch: ExistingBuJob[] = Array.isArray(data) ? data : data.jobs
      if (!Array.isArray(batch)) throw new Error('ข้อมูลเลข BU ไม่ถูกต้อง')
      jobs.push(...batch)
      if (Array.isArray(data) || jobs.length >= data.total || batch.length < 200) return jobs
    }
  }))
  return lists.flat()
}
