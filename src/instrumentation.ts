export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { exitOnInvalidServerEnv } = await import('@/lib/env')
    exitOnInvalidServerEnv()
  }
}
