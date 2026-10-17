export function compareNatural(a: string, b: string): number {
  const left = String(a).trim()
  const right = String(b).trim()
  const leftParts = left.match(/\d+|\D+/g) ?? []
  const rightParts = right.match(/\d+|\D+/g) ?? []

  for (let i = 0; i < Math.min(leftParts.length, rightParts.length); i++) {
    const leftPart = leftParts[i]
    const rightPart = rightParts[i]
    const leftIsNumber = /^\d+$/.test(leftPart)
    const rightIsNumber = /^\d+$/.test(rightPart)

    if (leftIsNumber && rightIsNumber) {
      const numericDifference = Number(leftPart) - Number(rightPart)
      if (numericDifference !== 0) return numericDifference
      continue
    }

    const textDifference = leftPart.localeCompare(rightPart, 'th', { sensitivity: 'base' })
    if (textDifference !== 0) return textDifference
  }

  return leftParts.length - rightParts.length || left.localeCompare(right, 'th', { sensitivity: 'base' })
}
