'use client'

import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Box, Loader2, Download, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense, useEffect } from 'react'
import { logActivity } from '@/lib/logActivity'

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

function proxyDownloadUrl(fileUrl: string, fileName: string) {
  return `/api/file-proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`
}

function FileActions({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button asChild variant="outline" size="sm" className="rounded-full h-7 gap-1 text-xs px-2.5">
        <a href={proxyDownloadUrl(url, name)} download={name}>
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

  useEffect(() => {
    if (!open) return
    if (showSplit) {
      logActivity('view_split', fileName, `PDF: ${pdfFile?.file_name} | 3D: ${threeDFile?.file_name}`)
    } else if (isPdf) {
      logActivity('view_pdf', fileName)
    } else if (is3d) {
      logActivity('view_3d', fileName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (showSplit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !max-w-none !max-h-none !rounded-none !border-0 flex flex-col p-0 gap-0 overflow-hidden font-sans bg-slate-900 text-white z-[9999]">
          {/* Header */}
          <div className="flex flex-row items-center justify-between px-6 py-3 bg-[#1e293b] text-white border-b border-slate-700 shrink-0 gap-4">
            <div className="flex items-center gap-4 text-sm font-bold text-slate-100 min-w-0">
              <span className="flex items-center gap-1.5 shrink-0">
                <FileText className="h-4 w-4 text-rose-400" />
                <span className="truncate max-w-[220px] text-slate-100">{pdfFile.file_name}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <Box className="h-4 w-4 text-sky-400" />
                <span className="truncate max-w-[220px] text-slate-100">{threeDFile.file_name}</span>
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                เต็มจอ (Split View)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FileActions url={pdfFile.file_url} name={pdfFile.file_name} />
              <div className="w-px h-5 bg-slate-700" />
              <FileActions url={threeDFile.file_url} name={threeDFile.file_name} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-full h-7 gap-1 px-3 text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white border-rose-500/50 hover:border-rose-400 ml-2"
              >
                <X className="h-3.5 w-3.5" /> <span>ปิด</span>
              </Button>
            </div>
          </div>

          {/* Split body */}
          <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-950">
            {/* Left: PDF */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-slate-800 overflow-hidden">
              <div className="px-4 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0 flex items-center justify-between">
                <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Drawing PDF
                </p>
                <a href={pdfFile.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-slate-400 hover:text-white underline">
                  เปิดแท็บใหม่
                </a>
              </div>
              <div className="flex-1 relative overflow-hidden bg-white">
                <iframe
                  src={`${pdfFile.file_url}#toolbar=0&navpanes=0&scrollbar=1&view=Fit`}
                  className="absolute inset-0 w-full h-full border-0 bg-white"
                  title={pdfFile.file_name}
                />
              </div>
            </div>

            {/* Right: 3D */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="px-4 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0">
                <p className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1">
                  <Box className="h-3.5 w-3.5" /> 3D Model
                </p>
              </div>
              <div className="flex-1 relative overflow-hidden bg-slate-900">
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
      <DialogContent showCloseButton={false} className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !max-w-none !max-h-none !rounded-none !border-0 flex flex-col p-0 gap-0 overflow-hidden font-sans bg-slate-900 text-white z-[9999]">
        <div className="flex flex-row items-center justify-between px-6 py-3 bg-[#1e293b] text-white border-b border-slate-700 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf
              ? <FileText className="h-5 w-5 text-rose-400 shrink-0" />
              : <Box className="h-5 w-5 text-sky-400 shrink-0" />}
            <span className="font-bold text-sm md:text-base text-slate-100 truncate max-w-[400px]">{fileName}</span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
              โหมดดูแบบเต็มจอ
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="rounded-full h-8 gap-1 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
              <a href={proxyDownloadUrl(fileUrl, fileName)} download={fileName}>
                <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">ดาวน์โหลด</span>
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full h-8 gap-1 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">เปิดแท็บใหม่</span>
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-full h-8 gap-1 px-3 text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white border-rose-500/50 hover:border-rose-400 ml-1"
            >
              <X className="h-4 w-4" /> <span>ปิด</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full h-full overflow-hidden bg-slate-950 relative">
          {isPdf && (
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=Fit`}
              className="w-full h-full border-0 bg-white"
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
