import { closePool } from './pool'

export async function disconnectDatabase(): Promise<void> {
  await closePool()
}
