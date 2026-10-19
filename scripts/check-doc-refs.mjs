import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const docs = args.length > 0 ? args : ['AGENTS.md', 'README.md']

const files = new Set(
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => file && existsSync(file))
)
const dirs = new Set(
  [...files].flatMap((file) =>
    file
      .split('/')
      .slice(0, -1)
      .map((_, index, parts) => parts.slice(0, index + 1).join('/'))
  )
)
const topDirs = [...dirs].filter((dir) => !dir.includes('/'))
const basenames = new Set([...files].map((file) => file.split('/').pop()))

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = new Set(Object.keys(pkg.scripts))
const dependencies = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]
const lockedPackages = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages
const npxTools = new Set(
  dependencies.flatMap((name) => [
    name,
    ...Object.keys(lockedPackages[`node_modules/${name}`]?.bin ?? {}),
  ])
)

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const segment = String.raw`(?:[\w.-]|\[[\w.-]+\]|\([\w.-]+\))+`
const pathPattern = new RegExp(
  String.raw`(?<![\w/.:@-])(?:\.\/)?(${segment}(?:\/${segment})+)`,
  'g'
)
const repoPathStart = new RegExp(`^(?:${topDirs.map(escape).join('|')})/`)
const fileExtension = /\.[a-z]+$/
const fileNamePattern = /`([\w.-]+\.(?:ts|tsx|mjs|js|json|ya?ml|md|sql|toml))`/g

function lineProblems(line) {
  const problems = []
  for (const [, match] of line.matchAll(/\bnpm run ([\w:.-]+)/g)) {
    const script = match.replace(/\.+$/, '')
    if (!scripts.has(script)) problems.push(`npm script "${script}" is not in package.json`)
  }
  for (const [, script] of line.matchAll(/\bnpm (test|start)\b/g))
    if (!scripts.has(script)) problems.push(`npm script "${script}" is not in package.json`)
  for (const [, match] of line.matchAll(/\bnpx (?:-\S+ )*([a-z@][\w@/.-]*)/g)) {
    const tool = match.replace(/(?<=.)@[^/]*$/, '')
    if (!npxTools.has(tool)) problems.push(`"npx ${tool}" is not provided by any dependency`)
  }
  for (const [, match] of line.matchAll(pathPattern)) {
    const path = match.replace(/\.+$/, '')
    if (!repoPathStart.test(path) && !fileExtension.test(path)) continue
    if (!files.has(path) && !dirs.has(path)) problems.push(`path ${path} does not exist`)
  }
  for (const [, name] of line.matchAll(fileNamePattern))
    if (!basenames.has(name)) problems.push(`file ${name} does not exist`)
  return problems
}

const problems = docs.flatMap((doc) =>
  readFileSync(doc, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      lineProblems(line).map((problem) => `${doc}:${index + 1}: ${problem}`)
    )
)

if (problems.length > 0) {
  console.error(`${problems.length} stale reference(s):\n${problems.join('\n')}`)
  process.exit(1)
}
console.log(`Doc references OK: ${docs.join(', ')}.`)
