import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { selectAll } from '../table'
import { funnelSteps } from '../tables'
import { recordFunnelStep } from '../funnel-steps'

const visitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

describe('recordFunnelStep', () => {
  it('inserts one row per view, stamped with an id and the time', async () => {
    const before = Date.now()

    await recordFunnelStep({
      visitorId,
      step: '/symptoms',
      stepOrder: 9,
      locale: 'es',
      attributionChannel: 'google_ads',
    })
    await recordFunnelStep({
      visitorId,
      step: '/symptoms',
      stepOrder: 9,
      locale: 'es',
      attributionChannel: null,
    })

    const rows = await db.rows(
      sql`SELECT ${selectAll(funnelSteps)} FROM funnel_steps ORDER BY attribution_channel NULLS LAST`
    )
    expect(rows).toEqual([
      {
        id: expect.any(String),
        visitorId,
        step: '/symptoms',
        stepOrder: 9,
        locale: 'es',
        attributionChannel: 'google_ads',
        createdAt: expect.any(Date),
      },
      expect.objectContaining({ visitorId, attributionChannel: null }),
    ])
    expect(rows[0].id).not.toBe(rows[1].id)
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })
})
