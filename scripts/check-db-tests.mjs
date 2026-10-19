import { existsSync, readdirSync, readFileSync } from 'node:fs'

const PURE = new Set(['types.ts', 'sql.ts', 'table.ts', 'test-database.ts'])

function testsModule(file) {
  const name = file.replace(/\.ts$/, '')
  const test = `src/db/__tests__/${name}.db.test.ts`
  return existsSync(test) && readFileSync(test, 'utf8').includes(`'../${name}'`)
}

const modules = readdirSync('src/db').filter((file) => file.endsWith('.ts') && !PURE.has(file))
const missing = modules.filter((file) => !testsModule(file))

if (missing.length > 0) {
  console.error(
    `${missing.length} src/db module(s) have no database test that imports them. Add src/db/__tests__/<module>.db.test.ts importing '../<module>' for:`
  )
  console.error(missing.map((file) => `  src/db/${file}`).join('\n'))
  process.exit(1)
}
console.log(`Every src/db module has a database test (${modules.length} modules).`)
