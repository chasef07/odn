import { parseArgs } from 'node:util'
import { settleRefundReservation } from '../src/app/admin/_actions/shared'
import { disconnectDatabase } from '../src/db/connection'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { 'release-to': { type: 'string' } },
})

const usage =
  'usage: npx tsx scripts/settle-refund-reservation.ts <submission id> [--release-to <status>]'

async function settle(): Promise<void> {
  const [id] = positionals
  if (!id) throw new Error(usage)
  const settled = await settleRefundReservation(id, values['release-to'])
  if (settled.settled === 'recorded') {
    console.log(
      `recorded Stripe refund ${settled.refundId} on submission ${id}; ${settled.notice.warning ?? 'denial email sent'}`
    )
    return
  }
  console.log(`released the reservation on submission ${id}; it is ${settled.status} again`)
}

settle()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
