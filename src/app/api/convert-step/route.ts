import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createRequire } from 'module'

// บังคับใช้ Node.js runtime (ไม่ใช่ Edge)
export const runtime = 'nodejs'

const JWT_SECRET = process.env.JWT_SECRET!

function getToken(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('auth_token')?.value ?? null
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  try { jwt.verify(token, JWT_SECRET) } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let fileUrl: string
  try {
    const body = await req.json()
    fileUrl = body.fileUrl
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  if (!fileUrl) return NextResponse.json({ message: 'Missing fileUrl' }, { status: 400 })

  // Fetch STEP file server-side
  let buffer: Uint8Array
  try {
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ message: `ดาวน์โหลดไฟล์ไม่สำเร็จ (${fileRes.status})` }, { status: 502 })
    }
    buffer = new Uint8Array(await fileRes.arrayBuffer())
  } catch (e) {
    console.error('[convert-step] fetch error:', e)
    return NextResponse.json({ message: 'เชื่อมต่อ R2 ไม่สำเร็จ' }, { status: 502 })
  }

  // Load occt-import-js — ใช้ createRequire เพื่อหลีกเลี่ยง webpack bundle
  let occt: { ReadStepFile: (buf: Uint8Array, params: null) => { success: boolean; meshes: unknown[] } }
  try {
    const require = createRequire(import.meta.url)
    const occtimportjs = require('occt-import-js')
    occt = await occtimportjs()
  } catch (e) {
    console.error('[convert-step] occt load error:', e)
    return NextResponse.json({ message: 'โหลด OCCT engine ไม่สำเร็จ' }, { status: 500 })
  }

  // Parse STEP
  let result: { success: boolean; meshes: unknown[] }
  try {
    result = occt.ReadStepFile(buffer, null)
  } catch (e) {
    console.error('[convert-step] ReadStepFile error:', e)
    return NextResponse.json({ message: 'แปลงไฟล์ STEP ไม่สำเร็จ' }, { status: 422 })
  }

  if (!result?.success || !Array.isArray(result.meshes) || result.meshes.length === 0) {
    return NextResponse.json({ message: 'ไฟล์ STEP ไม่มีข้อมูล geometry' }, { status: 422 })
  }

  // แปลง mesh เป็น flat arrays
  type OcctMesh = {
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index?: { array: number[] }
    color?: [number, number, number]
  }

  const meshes = (result.meshes as OcctMesh[]).map((m) => ({
    position: Array.from(m.attributes.position.array),
    normal: m.attributes.normal ? Array.from(m.attributes.normal.array) : null,
    index: m.index ? Array.from(m.index.array) : null,
    color: m.color ?? null,
  }))

  return NextResponse.json({ meshes })
}
