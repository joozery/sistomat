import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// เฉพาะบ่งชี้ role เพื่อ redirect เร็วๆ ระดับหน้าเว็บ — ไม่ verify signature
// (การบังคับสิทธิ์จริงอยู่ที่ jwt.verify + role check ใน API routes)
function decodeRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

const ADMIN_ONLY_PATHS = ['/dashboard/user-management', '/dashboard/settings']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (token && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (decodeRole(token) !== 'Admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
