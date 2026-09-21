import { ProcessJobsPage } from '@/components/pages/all-plans/ProcessJobsPage'

function safeDecode(value: string) {
  try { return decodeURIComponent(value) }
  catch { return value }
}

export default async function AllPlansProcessPage({ params }: { params: Promise<{ process: string }> }) {
  const { process } = await params
  return <ProcessJobsPage processName={safeDecode(process)} />
}
