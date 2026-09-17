'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { PrintJobSheet } from '@/components/pages/process-details/PrintJobSheet'
import type { ProcessRow } from '@/components/pages/process-details/ProcessTable'

interface Attachment { file_url: string; file_name: string }
interface PrintableJob {
  jobId: string
  receivedDate: string
  dueDate: string
  processList: ProcessRow[]
  fileUrl?: string
  fileName?: string
  attachments?: Attachment[] | null
}

function getToken() { return localStorage.getItem('token') ?? '' }
function formatThaiDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function GroupPrintPage() {
  const { parentId } = useParams<{ parentId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const group = searchParams.get('group') ?? parentId
  const ids = searchParams.get('ids')?.split(',').map(decodeURIComponent).filter(Boolean) ?? []
  const [jobs, setJobs] = useState<PrintableJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      const data = await Promise.all(ids.map(async (id) => {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`โหลดใบงาน ${id} ไม่สำเร็จ`)
        const project = await res.json()
        return {
          jobId: id,
          receivedDate: formatThaiDate(project.received_date ?? ''),
          dueDate: formatThaiDate(project.due_date ?? ''),
          processList: (project.processes ?? []) as ProcessRow[],
          fileUrl: project.file_url,
          fileName: project.file_name,
          attachments: project.attachments,
        }
      }))
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [ids.join(',')])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex h-screen items-center justify-center font-sans text-sm text-gray-500">กำลังโหลด...</div>
  if (error) return <div className="p-10 text-center font-sans text-red-600">{error}</div>

  return (
    <div id="group-print-overlay" className="fixed inset-0 z-[9999] overflow-y-auto bg-gray-300 font-sans">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @page drawing-landscape { size: A4 landscape; margin: 0; }
        @page process-portrait { size: A4 portrait; margin: 0; }
        @media screen {
          .group-print-sheet #print-area { display: block !important; }
          .group-print-sheet .print-page { margin: 0 auto 20px; border: 1px solid #bbb; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
        }
        @media print {
          html, body { width: 210mm !important; max-width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          [data-slot="sidebar-wrapper"] > *:not([data-slot="sidebar-inset"]) { display: none !important; }
          [data-slot="sidebar-wrapper"] { display: block !important; min-height: 0 !important; height: auto !important; }
          header, #toolbar { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; min-height: 0 !important; height: auto !important; overflow: visible !important; background: #fff !important; flex: none !important; }
          #group-print-overlay { position: static !important; width: 210mm !important; max-width: 210mm !important; height: auto !important; overflow: visible !important; background: #fff !important; padding: 0 !important; margin: 0 !important; }
          #pages-wrap { width: 210mm !important; max-width: 210mm !important; padding: 0 !important; margin: 0 !important; }
          .group-print-sheet #print-area { display: block !important; }
          .group-print-sheet .print-page { width: 210mm !important; max-width: 210mm !important; height: 295mm !important; max-height: 295mm !important; min-height: 0 !important; border: none !important; box-shadow: none !important; margin: 0 auto !important; padding: 10mm 12mm !important; box-sizing: border-box !important; page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; break-inside: avoid !important; overflow: hidden !important; }
          .group-print-sheet .print-page:not(.drawing-print-page) { page: process-portrait; }
          .group-print-sheet .drawing-print-page {
            page: drawing-landscape;
            width: 297mm !important;
            max-width: 297mm !important;
            height: 208mm !important;
            max-height: 208mm !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          #pages-wrap .group-print-sheet:last-child .print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
        }
      `}</style>
      <div id="toolbar" className="sticky top-0 z-10 mb-5 flex items-center justify-between bg-[#1a1a2e] px-6 py-2.5 text-white">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> กลับ</button>
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo2.png" alt="Sistomat" className="h-8 w-auto" />
          <span className="font-bold text-indigo-100">ตัวอย่างก่อนปริ้น — {group}</span>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-[#7B1A1A] px-5 py-2 text-sm font-bold text-white hover:bg-[#5C1212]"><Printer className="h-4 w-4" /> ปริ้นเลย</button>
      </div>
      <div id="pages-wrap" className="p-6">
        {jobs.map((job) => <div key={job.jobId} className="group-print-sheet"><PrintJobSheet {...job} dwgName="" /></div>)}
      </div>
    </div>
  )
}
