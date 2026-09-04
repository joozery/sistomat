'use client'

import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Box, Loader2, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false, loading: () => <SpinnerBox /> })

interface Attachment {
  file_url: string
  file_name: string
}

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  fileUrl: string
  fileName: string
  attachments?: Attachment[]
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

const IS_3D = ['stl', 'obj', 'glb', 'gltf', 'step', 'stp']

function FileActions({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button asChild variant="outline" size="sm" className="rounded-full h-7 gap-1 text-xs px-2.5">
        <a href={url} download={name}>
          <Download className="h-3 w-3" /> ดาวน์โหลด
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="rounded-full h-7 gap-1 text-xs px-2.5">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3 w-3" /> แท็บใหม่
        </a>
      </Button>
    </div>
  )
}

export function FilePreviewDialog({ open, onOpenChange, fileUrl, fileName, attachments }: FilePreviewDialogProps) {
  const ext = getExt(fileName)
  const isPdf = ext === 'pdf'
  const is3d = IS_3D.includes(ext)
  const isUnsupported = !isPdf && !is3d

  // Split view: detect PDF + 3D from attachments
  const pdfFile = attachments?.find((a) => getExt(a.file_name) === 'pdf')
  const threeDFile = attachments?.find((a) => IS_3D.includes(getExt(a.file_name)))
  const showSplit = !!(pdfFile && threeDFile)

  if (showSplit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-full h-[88vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden font-sans">
          {/* Header */}
          <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0 gap-4">
            <DialogTitle className="flex items-center gap-4 text-sm font-bold text-gray-800 min-w-0">
              <span className="flex items-center gap-1.5 shrink-0">
                <FileText className="h-4 w-4 text-red-500" />
                <span className="truncate max-w-[200px] text-gray-700">{pdfFile.file_name}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <Box className="h-4 w-4 text-blue-500" />
                <span className="truncate max-w-[200px] text-gray-700">{threeDFile.file_name}</span>
              </span>
            </DialogTitle>
            <div className="flex items-center gap-3 shrink-0">
              <FileActions url={pdfFile.file_url} name={pdfFile.file_name} />
              <div className="w-px h-5 bg-gray-200" />
              <FileActions url={threeDFile.file_url} name={threeDFile.file_name} />
            </div>
          </DialogHeader>

          {/* Split body */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left: PDF */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 overflow-hidden">
              <div className="px-3 py-1.5 bg-red-50 border-b border-red-100 shrink-0 flex items-center justify-between">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Drawing PDF
                </p>
                <a href={pdfFile.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-red-400 hover:text-red-600 underline">
                  เปิดแท็บใหม่
                </a>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <iframe
                  src={`${pdfFile.file_url}#toolbar=1&view=FitH`}
                  className="absolute inset-0 w-full h-full border-0"
                  title={pdfFile.file_name}
                />
              </div>
            </div>

            {/* Right: 3D */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 shrink-0">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                  <Box className="h-3 w-3" /> 3D Model
                </p>
              </div>
              <div className="flex-1 relative overflow-hidden bg-gray-50">
                <Suspense fallback={<SpinnerBox />}>
                  <Viewer3D fileUrl={threeDFile.file_url} ext={getExt(threeDFile.file_name)} />
                </Suspense>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Single file view
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
            <iframe src={fileUrl} className="w-full h-full border-0" title={fileName} />
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
