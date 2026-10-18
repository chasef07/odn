import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FILE = 'eslint-suppressions.json'
const base = process.argv[2] ?? process.env.SUPPRESSIONS_BASE ?? 'origin/main'

function counts(suppressions) {
  return new Map(
    Object.entries(suppressions).flatMap(([file, rules]) =>
      Object.entries(rules).map(([rule, { count }]) => [`${file} ${rule}`, count])
    )
  )
}

function baseSuppressions() {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], { stdio: 'pipe' })
  } catch {
    console.error(`check-suppressions: base ${base} is not a commit here. Run git fetch origin.`)
    process.exit(1)
  }
  const listed = execFileSync('git', ['ls-tree', '--name-only', base, '--', FILE], {
    encoding: 'utf8',
  })
  if (listed.trim() === '') return null
  return JSON.parse(execFileSync('git', ['show', `${base}:${FILE}`], { encoding: 'utf8' }))
}

const previous = baseSuppressions()
if (previous === null) {
  console.log(`check-suppressions: ${base} has no ${FILE}, so this change introduces it.`)
  process.exit(0)
}

const before = counts(previous)
const grown = [...counts(JSON.parse(readFileSync(FILE, 'utf8')))].filter(
  ([key, count]) => count > (before.get(key) ?? 0)
)

if (grown.length > 0) {
  console.error(`check-suppressions: ${FILE} grew against ${base}. Fix the violation instead:`)
  for (const [key, count] of grown) {
    console.error(`  ${key}: ${before.get(key) ?? 0} -> ${count}`)
  }
  process.exit(1)
}

console.log(`check-suppressions: ${FILE} did not grow against ${base}.`)
