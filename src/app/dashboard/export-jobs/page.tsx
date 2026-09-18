import { Suspense } from 'react'
import { ExportJobsPage } from '@/components/pages/export-jobs/ExportJobsPage'

export default function Page() {
  return (
    <Suspense>
      <ExportJobsPage />
    </Suspense>
  )
}
