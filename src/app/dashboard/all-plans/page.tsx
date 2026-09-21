import { Suspense } from 'react'
import { AllPlansOverview } from '@/components/pages/all-plans/AllPlansOverview'

export default function AllPlansPage() {
  return (
    <Suspense>
      <AllPlansOverview />
    </Suspense>
  )
}
