import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export function getRequestToken(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7) : req.cookies.get('auth_token')?.value ?? null
}

export function verifyIT(req: NextRequest) {
  const token = getRequestToken(req)
  if (!token) return { ok: false as const, status: 401, error: 'Unauthorized' }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role?: string }
    if (payload.role?.trim().toUpperCase() !== 'IT') return { ok: false as const, status: 403, error: 'Forbidden' }
    return { ok: true as const, payload }
  } catch {
    return { ok: false as const, status: 401, error: 'Unauthorized' }
  }
}
