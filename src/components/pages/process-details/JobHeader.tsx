'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Tag, Download, QrCode, Barcode, RotateCcw, PauseCircle, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileThumbnail } from '@/components/pages/process-qrcode/FileThumbnail'
import { FilePreviewDialog } from '@/components/pages/process-qrcode/FilePreviewDialog'
import { useCurrentUser } from '@/lib/useCurrentUser'

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false })
const Barcoder = dynamic(() => import('react-barcode'), { ssr: false })

interface JobHeaderAttachment {
  file_url: string
  file_name: string
}

interface JobHeaderProps {
  id: string
  dwgName?: string
  receivedDate: string
  dueDate: string
  fileUrl?: string
  fileName?: string
  attachments?: JobHeaderAttachment[]
  hasRework?: boolean
  hasHold?: boolean
  activeHolds?: { process: string; reason?: string }[]
  pastHolds?: { process: string; reason?: string; round: number; held_at: string | null; released_at: string | null }[]
}

export function JobHeader({ id, dwgName, receivedDate, dueDate, fileUrl, fileName, attachments, hasRework, hasHold, activeHolds = [], pastHolds = [] }: JobHeaderProps) {
  const { role } = useCurrentUser()
  const canViewHoldHistory = ['admin', 'superadmin'].includes(role.trim().toLowerCase())
  // ช่างต้องเปิดดูไฟล์ PDF/3D, QR/บาร์โค้ดใบงาน และใบงาน QC ได้ (ต้องใช้แบบงานจริง) — จำกัดเฉพาะ role User เท่านั้นที่เปิดไม่ได้
  const canViewFile = role !== 'User'
  const codeRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'qr' | 'barcode'>('qr')
  const [previewOpen, setPreviewOpen] = useState(false)
  const qrValue = dwgName?.trim() ? `${id}|${dwgName.trim()}` : id

  const handleDownload = () => {
    const container = codeRef.current
    if (!container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    const svgString = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = svg.width.baseVal.value * 2
    canvas.height = svg.height.baseVal.value * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const link = document.createElement('a')
      link.download = `${mode === 'qr' ? 'qrcode' : 'barcode'}-${id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  }

  return (
    <Card className="rounded-xl border border-gray-100 bg-white p-2 shadow-none font-sans">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">

          {/* Job Details */}
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-[#7B1A1A] border border-red-100 text-xs font-bold">
              <Tag className="h-3.5 w-3.5" />
              JOB ID: {id}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              รายละเอียดกระบวนการผลิต #{id}
            </h2>
            {dwgName && (
              <p className="text-sm font-medium text-gray-600">
                DWG: <span className="text-gray-800 font-semibold">{dwgName}</span>
              </p>
            )}
            <p className="text-xs text-gray-400">
              บาร์โค้ดประจำใบงานสำหรับสแกนเข้าสถานีปฏิบัติงาน
            </p>
            {activeHolds.map((hold, index) => (
              <div key={index} role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 break-words whitespace-pre-wrap">
                <span className="font-bold">HOLD — {hold.process}</span>: {hold.reason || 'ไม่ได้ระบุเหตุผล'}
              </div>
            ))}
            {canViewHoldHistory && pastHolds.map((hold, index) => (
              <div key={index} className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 break-words whitespace-pre-wrap">
                <span className="font-semibold">เคยมีการ Hold — {hold.process} รอบ {hold.round}</span>: {hold.reason || 'ไม่ได้ระบุเหตุผล'} <span className="text-xs">(ปลดแล้ว)</span>
                <div className="text-xs">Hold: {hold.held_at || 'ไม่มีเวลาเดิม'} · ปลด: {hold.released_at || 'ไม่มีเวลาเดิม'}</div>
              </div>
            ))}
            {(hasRework || (canViewHoldHistory && hasHold)) && (
              <div className="flex items-center justify-center md:justify-start gap-1.5 pt-1">
                {hasRework && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-100">
                    <RotateCcw className="h-3 w-3" />
                    มีการ Rework
                  </span>
                )}
                {canViewHoldHistory && hasHold && activeHolds.length === 0 && pastHolds.length === 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100">
                    <PauseCircle className="h-3 w-3" />
                    เคยมีการ Hold
                  </span>
                )}
              </div>
            )}
            {canViewFile && fileUrl && fileName && (
              <div className="flex items-center justify-center md:justify-start gap-2 pt-1">
                <FileThumbnail
                  fileUrl={fileUrl}
                  fileName={fileName}
                  size={40}
                  onClick={() => setPreviewOpen(true)}
                />
                <div className="text-left">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[160px]">{fileName}</p>
                  <p className="text-[10px] text-gray-400">คลิกเพื่อดู PDF/3D</p>
                </div>
                <Link
                  href={`/dashboard/process-details/${id}/qc`}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0"
                >
                  <ClipboardCheck className="h-3 w-3" />
                  ดูใบงาน QC
                </Link>
              </div>
            )}
          </div>

          {/* Code display + toggle + Download — ช่างต้องเห็น/โหลด QR-บาร์โค้ดใบงานได้ */}
          {canViewFile && (
          <div className="flex flex-col items-center gap-2">
            {/* Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full">
              <button
                onClick={() => setMode('qr')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  mode === 'qr'
                    ? 'bg-white text-[#7B1A1A] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                QR Code
              </button>
              <button
                onClick={() => setMode('barcode')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  mode === 'barcode'
                    ? 'bg-white text-[#7B1A1A] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Barcode className="h-3.5 w-3.5" />
                Barcode
              </button>
            </div>

            {/* Code */}
            <div
              ref={codeRef}
              className="flex items-center justify-center px-4 pt-3 pb-2 bg-white rounded-2xl border border-gray-200"
            >
              {mode === 'qr' ? (
                <div className="flex flex-col items-center gap-1">
                  <QRCodeSVG
                    value={qrValue}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    marginSize={1}
                  />
                  <p className="text-[11px] font-bold text-gray-800">{id}</p>
                  {dwgName && (
                    <p className="text-[10px] text-gray-500 text-center max-w-[160px] leading-tight">{dwgName}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Barcoder
                    value={id}
                    format="CODE128"
                    width={1.5}
                    height={80}
                    fontSize={12}
                    margin={4}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                  <p className="text-[10px] text-gray-400 text-center max-w-[200px] leading-tight">
                    สำหรับปริ้นกระดาษ — สแกนจากจอไม่ได้
                  </p>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleDownload}
              variant="outline"
              className="gap-2 rounded-full h-8 text-xs font-semibold border-gray-200 text-gray-600 hover:bg-gray-50 px-4"
            >
              <Download className="h-3.5 w-3.5" />
              โหลด {mode === 'qr' ? 'QR Code' : 'Barcode'} PNG
            </Button>
          </div>
          )}

          {/* Date Information */}
          <div className="flex flex-col gap-2 min-w-[180px]">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
              <span className="text-gray-400 font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                วันรับงาน:
              </span>
              <span className="font-bold text-gray-800">{receivedDate}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/60 border border-red-100 text-xs">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#7B1A1A]" />
                กำหนดส่ง:
              </span>
              <span className="font-bold text-[#7B1A1A]">{dueDate}</span>
            </div>
          </div>

        </div>
      </CardContent>

      {canViewFile && fileUrl && fileName && (
        <FilePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileUrl={fileUrl}
          fileName={fileName}
          attachments={attachments}
        />
      )}
    </Card>
  )
}
