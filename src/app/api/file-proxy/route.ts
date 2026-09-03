import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.searchParams.get('url')
  const r2PublicUrl = process.env.R2_PUBLIC_URL!
  if (!url || !url.startsWith(r2PublicUrl)) {
    return NextResponse.json({ message: 'Invalid url' }, { status: 400 })
  }

  const range = req.headers.get('range')
  const upstream = await fetch(url, {
    headers: range ? { Range: range } : undefined,
  })

  const headers = new Headers()
  for (const h of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
