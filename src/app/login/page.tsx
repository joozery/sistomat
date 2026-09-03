import Image from 'next/image'
import { LoginCard } from '@/components/pages/login/LoginCard'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen relative flex items-center justify-center bg-cover bg-center bg-no-repeat overflow-hidden font-sans"
      style={{ backgroundImage: "url('/bg/bg.png')" }}
    >
      <div className="absolute top-0 left-0 p-10 xl:p-14 hidden lg:block">
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="Sistomat Logo"
            width={160}
            height={50}
            className="h-8 w-auto object-contain"
          />
        </div>
        <h1 className="text-3xl xl:text-4xl font-bold text-gray-800 leading-[1.3] mb-4">
          ยินดีต้อนรับ<br />
          สู่ <span className="text-[#7B1A1A]">ระบบบริหารจัดการ</span>
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          ลงชื่อเข้าใช้งานเพื่อเข้าถึงระบบ<br />
          และจัดการข้อมูลของคุณ
        </p>
      </div>

      <LoginCard />
    </div>
  )
}
