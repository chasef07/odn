import { spawnSync } from 'node:child_process'

const commandName = (command) => (process.platform === 'win32' ? `${command}.cmd` : command)

const run = (command, args) => {
  const result = spawnSync(commandName(command), args, {
    stdio: 'inherit',
  })

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (process.env.VERCEL_ENV === 'production') {
  run('npx', ['prisma', 'migrate', 'deploy'])
} else {
  process.stdout.write(
    `Skipping prisma migrate deploy for VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}.\n`
  )
}

run('npm', ['run', 'build'])
