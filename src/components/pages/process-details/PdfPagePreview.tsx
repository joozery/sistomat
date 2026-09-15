'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfPagePreviewProps {
  fileUrl: string
  className?: string
  onOrientation?: (isLandscape: boolean) => void
}

const PX_PER_MM = 7.559 // ~192dpi — sharp enough for print, cheap enough to render

export function PdfPagePreview({ fileUrl, className, onOrientation }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const proxiedUrl = `/api/file-proxy?url=${encodeURIComponent(fileUrl)}`
        const pdf = await pdfjsLib.getDocument({ url: proxiedUrl }).promise
        const page = await pdf.getPage(1)
        const baseViewport = page.getViewport({ scale: 1 })
        const isLandscape = baseViewport.width > baseViewport.height
        onOrientation?.(isLandscape)

        // The print page (page 1) switches to A4 landscape to match a landscape
        // drawing — see print/page.tsx's `@page :first` rule — so fit the render
        // to whichever orientation's box matches, instead of scaling to width
        // only (which made a landscape drawing render tiny on a portrait box).
        const pageWidthMm = isLandscape ? 297 : 210
        const pageHeightMm = isLandscape ? 210 : 297
        const scale = Math.min(
          (pageWidthMm * PX_PER_MM) / baseViewport.width,
          (pageHeightMm * PX_PER_MM) / baseViewport.height,
        )
        const viewport = page.getViewport({ scale })

        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')

        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        if (!cancelled) setStatus('done')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    render()
    return () => { cancelled = true }
  }, [fileUrl, onOrientation])

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {status === 'loading' && <span style={{ fontSize: 12, color: '#999' }}>กำลังโหลด PDF...</span>}
      {status === 'error' && <span style={{ fontSize: 12, color: '#c00' }}>ไม่สามารถโหลด PDF ได้</span>}
      <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: status === 'done' ? 'block' : 'none' }} />
    </div>
  )
}
