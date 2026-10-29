import { db } from './pool'
import { insert } from './table'
import { funnelSteps } from './tables'
import type { FunnelStepRecord } from './types'

export type NewFunnelStep = Omit<FunnelStepRecord, 'id' | 'createdAt'>

export async function recordFunnelStep(step: NewFunnelStep): Promise<void> {
  await db.affected(insert(funnelSteps, step))
}
