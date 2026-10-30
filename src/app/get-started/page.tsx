import { headers } from 'next/headers'
import { REGION_SUBDIVISION_HEADER, servedStateFromSubdivision } from '@/lib/detected-state'
import { GetStartedForm } from './GetStartedForm'

export default async function GetStartedPage() {
  const subdivision = (await headers()).get(REGION_SUBDIVISION_HEADER)
  return <GetStartedForm detectedState={servedStateFromSubdivision(subdivision)} />
}
