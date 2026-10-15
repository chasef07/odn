import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'

const HASH = /^\s*#/
const SLASHES = /^\s*\/\//
const SHEBANG = /^#!/
const DOCKERFILE_DIRECTIVE = /^#\s*(syntax|escape|check)\s*=/
const HASH_OR_TRAILING_HASH = /(^|\s)#/
const HASH_FILES = new Set(['.gitignore', '.dockerignore', '.prettierignore'])

function commentRule(file) {
  const name = basename(file)
  if (file.startsWith('prisma/migrations/')) return null
  if (name.startsWith('.env')) return { comment: HASH_OR_TRAILING_HASH }
  if (/\.(ya?ml|toml)$/.test(name) || HASH_FILES.has(name)) return { comment: HASH }
  if (name.startsWith('Dockerfile')) return { comment: HASH, directive: DOCKERFILE_DIRECTIVE }
  if (/\.(prisma|json)$/.test(name)) return { comment: SLASHES }
  return null
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file && existsSync(file) && commentRule(file))

const problems = []
for (const file of files) {
  const rule = commentRule(file)
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (!rule.comment.test(line)) return
      if (index === 0 && SHEBANG.test(line)) return
      if (rule.directive?.test(line)) return
      problems.push(`${file}:${index + 1}: ${line.trim()}`)
    })
}

if (problems.length > 0) {
  console.error(`${problems.length} comment line(s). Comments are not allowed, delete them:`)
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`No comments in ${files.length} config files.`)
