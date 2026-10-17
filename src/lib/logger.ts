type LogArgs = unknown[]

const isDevelopment = () => process.env.NODE_ENV === 'development'

type LogSeverity = 'WARNING' | 'ERROR'

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
  event: (severity: LogSeverity, fields: Record<string, unknown>) => {
    const line = JSON.stringify({ severity, ...fields })
    if (severity === 'ERROR') console.error(line)
    else console.warn(line)
  },
}
