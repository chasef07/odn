/**
 * Minimal structured logger.
 *
 * `debug` and `info` are no-ops outside development so verbose operational
 * logging doesn't leak into production output. `warn` and `error` always log
 * so failures remain visible in every environment.
 */
type LogArgs = unknown[]

const isDevelopment = () => process.env.NODE_ENV === 'development'

export const logger = {
  debug: (...args: LogArgs) => {
    // eslint-disable-next-line no-console
    if (isDevelopment()) console.debug(...args)
  },
  info: (...args: LogArgs) => {
    if (isDevelopment()) console.info(...args)
  },
  warn: (...args: LogArgs) => {
    console.warn(...args)
  },
  error: (...args: LogArgs) => {
    console.error(...args)
  },
}
