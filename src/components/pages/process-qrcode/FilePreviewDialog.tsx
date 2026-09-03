'use client'

import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Box, Loader2, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false, loading: () => <SpinnerBox /> })

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  fileUrl: string
  fileName: string
}

function SpinnerBox() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">กำลังโหลด...</p>
    </div>
  )
}

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function FilePreviewDialog({ open, onOpenChange, fileUrl, fileName }: FilePreviewDialogProps) {
  const ext = getExt(fileName)
  const isPdf = ext === 'pdf'
  const is3d = ['stl', 'obj', 'glb', 'gltf', 'step', 'stp'].includes(ext)
  const isUnsupported = !isPdf && !is3d

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden font-sans">
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-800 truncate pr-4">
            {isPdf
              ? <FileText className="h-4 w-4 text-red-500 shrink-0" />
              : <Box className="h-4 w-4 text-blue-500 shrink-0" />}
            <span className="truncate">{fileName}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="rounded-full h-8 gap-1 text-xs">
              <a href={fileUrl} download={fileName}>
                <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full h-8 gap-1 text-xs">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> เปิดแท็บใหม่
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-gray-50">
          {isPdf && (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          )}

          {is3d && (
            <Suspense fallback={<SpinnerBox />}>
              <Viewer3D fileUrl={fileUrl} ext={ext} />
            </Suspense>
          )}

          {isUnsupported && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Box className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">ไม่รองรับ preview สำหรับ .{ext}</p>
              <p className="text-xs text-gray-400">กรุณาดาวน์โหลดไฟล์เพื่อเปิดด้วยโปรแกรมอื่น</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
