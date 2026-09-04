import { NextRequest, NextResponse } from 'next/server'
import { getClientPromise } from '@/lib/mongodb'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      )
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    const usersCollection = db.collection('users')

    const user = await usersCollection.findOne({ username })

    if (!user) {
      return NextResponse.json(
        { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Log login activity (fire-and-forget)
    const client2 = await getClientPromise()
    client2.db('sistomat').collection('activity_logs').insertOne({
      username: user.username,
      role: user.role || 'Member',
      action: 'login',
      target: '',
      detail: `เข้าสู่ระบบสำเร็จ`,
      created_at: new Date(),
    }).catch(() => {})

    return NextResponse.json({
      token,
      user: {
        username: user.username,
        role: user.role || 'Member',
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}
