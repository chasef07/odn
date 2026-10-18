import { parseArgs } from 'node:util'
import { disconnectDatabase } from '../src/db/connection'
import { refundState, transition } from '../src/db/submission-lifecycle'
import { findSubmissionById } from '../src/db/submissions'
import { SubmissionStatus } from '../src/db/types'
import { stripe } from '../src/lib/stripe'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { 'release-to': { type: 'string' } },
})

const usage =
  'usage: npx tsx scripts/settle-refund-reservation.ts <submission id> [--release-to <status>]'

async function settle(): Promise<void> {
  const [id] = positionals
  if (!id) throw new Error(usage)
  const row = await findSubmissionById(id)
  if (!row) throw new Error(`submission ${id} not found`)
  if (refundState(row.stripeRefundId) !== 'reserved') {
    throw new Error(`submission ${id} holds no refund reservation (${row.stripeRefundId})`)
  }

  const refunds = await stripe.refunds.list({
    payment_intent: row.stripePaymentIntentId,
    limit: 100,
  })
  const refund = refunds.data.find((candidate) => candidate.metadata?.submissionId === id)
  const at = new Date()

  if (refund) {
    const recorded = await transition(
      { transition: 'recordRefund', row },
      { at, stripeRefundId: refund.id }
    )
    if (!recorded.ok) throw new Error(`record refused: ${recorded.refusal.reason}`)
    console.log(`recorded Stripe refund ${refund.id} on submission ${id}`)
    return
  }

  const releaseTo = values['release-to']
  if (!releaseTo) {
    throw new Error(
      `Stripe holds no refund for ${row.stripePaymentIntentId}; rerun with --release-to <${Object.values(SubmissionStatus).join('|')}> to release the reservation`
    )
  }
  const status = Object.values(SubmissionStatus).find((candidate) => candidate === releaseTo)
  if (!status) throw new Error(`${releaseTo} is not a submission status`)
  const released = await transition(
    { transition: 'releaseRefund', row },
    {
      at,
      prior: {
        ...row,
        status,
        stripeRefundId: null,
        denialReason: null,
        reviewedByAdminId: null,
        reviewedAt: null,
      },
    }
  )
  if (!released.ok) throw new Error(`release refused: ${released.refusal.reason}`)
  console.log(`released the reservation on submission ${id}; it is ${status} again`)
}

settle()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
