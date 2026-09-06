'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

const API_URL = '/api/users/login'

export function LoginCard() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (response.ok) {
        document.cookie = `auth_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`
        localStorage.setItem('token', data.token)
        localStorage.setItem('auth', 'true')
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
        router.push('/dashboard')
      } else {
        setError(data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setError('มีปัญหาในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-[420px] mx-4 p-6 md:p-8 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] border-0 bg-white/96 backdrop-blur-md">
      <CardHeader className="items-center pb-6 pt-2">
        <div className="flex justify-center w-full mb-5">
          <Image
            src="/logo.svg"
            alt="Sistomat Logo"
            width={130}
            height={50}
            className="h-12 w-auto drop-shadow-sm"
          />
        </div>
        <CardTitle className="text-xl font-bold text-gray-800 flex flex-col items-center">
          เข้าสู่ระบบ
          <div className="w-8 h-[3px] bg-[#7B1A1A] rounded-full mt-2.5" />
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {error && (
          <p className="text-[#7B1A1A] text-sm text-center mb-5 bg-red-50 border border-red-100 rounded-lg py-2.5 px-4">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-semibold text-gray-700">ชื่อผู้ใช้งาน</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-[18px] w-[18px]" />
              <Input
                id="username"
                placeholder="username หรือรหัสพนักงาน"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                className="pl-11 bg-[#f8fafe] border-transparent focus:border-[#7B1A1A] focus:ring-[#7B1A1A] rounded-xl h-[48px] text-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold text-gray-700">รหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-[18px] w-[18px]" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-11 pr-12 bg-[#f8fafe] border-transparent focus:border-[#7B1A1A] focus:ring-[#7B1A1A] rounded-xl h-[48px] text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-[#7B1A1A]"
                defaultChecked
              />
              <span className="text-gray-500 group-hover:text-gray-700 transition-colors">จดจำการเข้าสู่ระบบ</span>
            </label>
            <a href="#" className="text-[#7B1A1A] font-medium hover:underline hover:text-[#5C1212] transition-colors">
              ลืมรหัสผ่าน?
            </a>
          </div>

          <Button
            type="submit"
            className="w-full h-[48px] rounded-xl bg-gradient-to-r from-[#7B1A1A] to-[#8B2020] hover:from-[#5C1212] hover:to-[#7B1A1A] text-white font-medium text-[15px] shadow-lg shadow-red-500/30 transition-all gap-2 mt-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                เข้าสู่ระบบ
                <ArrowRight className="w-[18px] h-[18px]" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[11px] text-gray-400 font-medium">
          © 2024 SISTOMAT. สงวนลิขสิทธิ์.
        </div>
      </CardContent>
    </Card>
  )
}
