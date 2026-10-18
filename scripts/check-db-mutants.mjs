import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const KERNEL = new Set([
  'sql',
  'table',
  'tables',
  'pool',
  'migrate',
  'test-database',
  'types',
  'auth',
])

const ONE_ACTIVE_JOB =
  'The partial unique index sms_support_jobs_active_ticket_kind_key allows one active job per ticket and kind, so the WHERE matches at most one row.'

const EQUIVALENT = [
  {
    module: 'sms-support',
    function: 'listSupportTickets',
    mutation: 'drop WHERE: support_ticket_id = ANY(${array(ids)})',
    reason:
      'Messages are grouped by ticket and read back only for the listed ids, so rows of other tickets are fetched and never returned.',
  },
  {
    module: 'sms-support',
    function: 'listSupportTickets',
    mutation: 'drop WHERE: ticket_id = ANY(${array(ids)})',
    reason:
      'Jobs are grouped by ticket and read back only for the listed ids, so rows of other tickets are fetched and never returned.',
  },
  {
    module: 'sms-support',
    function: 'findActiveSupportAutomationJob',
    mutation: 'flip ORDER BY: created_at DESC',
    reason: ONE_ACTIVE_JOB,
  },
  {
    module: 'sms-support',
    function: 'findActiveSupportAutomationJob',
    mutation: 'drop ORDER BY: created_at DESC',
    reason: ONE_ACTIVE_JOB,
  },
  {
    module: 'submissions',
    function: 'findSmsSupportSubmissionCandidatesForPhone',
    mutation:
      'drop conjunct: submission_id = ANY(${array(candidates.map((candidate) => candidate.id))})',
    reason:
      'Messages are matched to candidates by submissionId in JS and only the count per candidate is read, so rows of other submissions are fetched and never returned.',
  },
]

const MUTANTS_PER_JOB = 150

const ORDERED_KINDS = new Set(['int', 'timestamp', 'date'])
const COLUMN = /\b(?:col|nullable)\('(\w+)', '(\w+)'\)|\b(uuid|jsonCol|nullableJson)\('(\w+)'/g
const OPERATOR = /(?<![<>!=-])(<>|<=|>=|=|<|>)(?![=<>])/g
const SWAPS = {
  '=': ['<>', '>=', '<='],
  '<>': ['='],
  '<': ['<='],
  '<=': ['<'],
  '>': ['>='],
  '>=': ['>'],
}

function orderedColumns() {
  const kinds = new Map()
  for (const match of readFileSync('src/db/tables.ts', 'utf8').matchAll(COLUMN)) {
    const [name, kind] = match[1] ? [match[1], match[2]] : [match[4], match[3]]
    kinds.set(name, [...(kinds.get(name) ?? []), kind])
  }
  return new Set(
    [...kinds]
      .filter(([, all]) => all.every((kind) => ORDERED_KINDS.has(kind)))
      .map(([name]) => name)
  )
}

function enumMembers(source) {
  const files = [...source.matchAll(/^import [^;]*? from '([^']+)'/gms)].map(([, specifier]) =>
    specifier.startsWith('@/')
      ? `src/${specifier.slice(2)}.ts`
      : specifier.startsWith('./')
        ? `src/db/${specifier.slice(2)}.ts`
        : null
  )
  const members = new Map()
  for (const text of [
    source,
    ...files.filter((file) => file && existsSync(file)).map((file) => readFileSync(file, 'utf8')),
  ]) {
    for (const [, name, body] of text.matchAll(/export const (\w+) = \{([^}]*)\} as const/g)) {
      members.set(
        name,
        [...body.matchAll(/(\w+):/g)].map(([, key]) => key)
      )
    }
  }
  return members
}

const KEYWORDS =
  /(?<![\w.])(SELECT|UPDATE|DELETE|INSERT|VALUES|SET|FROM|LEFT JOIN|INNER JOIN|JOIN|ON CONFLICT|ON|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|OFFSET|RETURNING|UNION)(?!\w)/g
const COMPARISON = /(=|<>|<|>|(?<![\w.])(LIKE|ILIKE|IS|IN|EXISTS)(?!\w))/
const HOLE = '\u0001'
const CLOSERS = { '(': ')', '[': ']', '{': '}' }

function skipString(source, index) {
  const quote = source[index]
  let at = index + 1
  while (source[at] !== quote) at += source[at] === '\\' ? 2 : 1
  return at + 1
}

function scanTemplate(source, index) {
  const holes = []
  let at = index
  while (source[at] !== '`') {
    if (source[at] === '\\') at += 2
    else if (source.startsWith('${', at)) {
      const close = scanCode(source, at + 2, '}')
      holes.push([at, close + 1])
      at = close + 1
    } else at++
  }
  return { end: at, holes }
}

function skip(source, at) {
  const char = source[at]
  if (char === "'" || char === '"') return skipString(source, at)
  if (char === '`') return scanTemplate(source, at + 1).end + 1
  if (CLOSERS[char]) return scanCode(source, at + 1, CLOSERS[char]) + 1
  return at + 1
}

function scanCode(source, index, closer) {
  for (let at = index; at < source.length; at = skip(source, at)) {
    if (source[at] === closer) return at
  }
  throw new Error(`unclosed ${closer} from offset ${index}`)
}

function splitList(text, start, end) {
  const parts = []
  let from = start
  for (let at = start; at < end; at = skip(text, at)) {
    if (text[at] !== ',') continue
    parts.push([from, at])
    from = at + 1
  }
  if (text.slice(from, end).trim()) parts.push([from, end])
  return parts
}

function declarationAt(source, index) {
  const lines = source.slice(0, index).split('\n')
  for (let line = lines.length - 1; line >= 0; line--) {
    const match = /^(?:export )?(?:async )?(?:function (\w+)|const (\w+))/.exec(lines[line])
    if (match) return match[1] ?? match[2]
  }
  return '(module)'
}

function mask(body, holes, offset) {
  const chars = [...body]
  for (const [start, end] of holes) chars.fill(HOLE, start - offset, end - offset)
  return chars.join('')
}

function depths(masked) {
  let level = 0
  return [...masked].map((char) => {
    if (char === ')') level--
    const depth = level
    if (char === '(') level++
    return depth
  })
}

function trim(masked, [start, end]) {
  while (start < end && /\s/.test(masked[start])) start++
  while (end > start && /\s/.test(masked[end - 1])) end--
  return [start, end]
}

function splitTop(masked, depth, [start, end], operator) {
  const pattern = new RegExp(`\\s+${operator}\\s+`, 'g')
  pattern.lastIndex = start
  const parts = []
  let from = start
  for (let match; (match = pattern.exec(masked)) && match.index < end; ) {
    if (depth[match.index] !== depth[start]) continue
    parts.push([from, match.index])
    from = match.index + match[0].length
  }
  parts.push([from, end])
  return parts
}

function wrapped(masked, depth, [start, end]) {
  if (masked[start] !== '(' || masked[end - 1] !== ')') return false
  for (let at = start + 1; at < end - 1; at++) if (depth[at] === depth[start]) return false
  return true
}

function dropped(parts, index) {
  if (index === 0) return [parts[0][0], parts[1][0]]
  return [parts[index - 1][1], parts[index][1]]
}

function predicate(masked, depth, range, emit) {
  if (wrapped(masked, depth, range))
    return predicate(masked, depth, [range[0] + 1, range[1] - 1], emit)
  for (const [operator, kind] of [
    ['AND', 'drop conjunct'],
    ['OR', 'drop disjunct'],
  ]) {
    const parts = splitTop(masked, depth, range, operator)
    if (parts.length === 1) continue
    parts.forEach((part, index) => {
      emit(kind, part, dropped(parts, index), '')
      if (wrapped(masked, depth, part)) predicate(masked, depth, part, emit)
    })
    return
  }
}

function clauses(masked, depth, [start, end]) {
  const found = []
  for (const match of masked.slice(start, end).matchAll(KEYWORDS)) {
    const at = start + match.index
    if (depth[at] === depth[start]) found.push({ keyword: match[1], at })
  }
  return found.map((clause, index) => ({
    ...clause,
    previous: found[index - 1]?.keyword,
    body: trim(masked, [clause.at + clause.keyword.length, found[index + 1]?.at ?? end]),
  }))
}

function statement(masked, depth, range, emit, singleRow) {
  for (const { keyword, at, previous, body } of clauses(masked, depth, range)) {
    let lead = at
    while (lead > 0 && /\s/.test(masked[lead - 1])) lead--
    const whole = [lead, body[1]]
    if (keyword === 'WHERE') {
      emit('drop WHERE', body, whole, '')
      predicate(masked, depth, body, emit)
    }
    if (keyword === 'ORDER BY') {
      emit('drop ORDER BY', body, whole, '')
      for (const part of splitList(masked, ...body)) {
        const term = trim(masked, part)
        const direction = / (ASC|DESC)$/.exec(masked.slice(...term))?.[1]
        if (direction) {
          const flipped = direction === 'ASC' ? 'DESC' : 'ASC'
          emit('flip ORDER BY', term, [term[1] - direction.length, term[1]], flipped)
        }
      }
    }
    if (keyword === 'RETURNING') emit('drop RETURNING', body, whole, '')
    const onlyRow = singleRow && masked.slice(...body) === '1'
    if ((keyword === 'LIMIT' && !onlyRow) || keyword === 'OFFSET')
      emit(`drop ${keyword}`, body, whole, '')
    if (keyword === 'ON' && previous?.endsWith('JOIN')) {
      for (const match of masked.slice(...body).matchAll(/(\w+\.\w+)\s*=\s*\w+\.\w+/g)) {
        const condition = [body[0] + match.index, body[0] + match.index + match[0].length]
        emit('break JOIN ON', condition, condition, `${match[1]} = ${match[1]}`)
      }
    }
  }
  for (const match of masked.slice(...range).matchAll(/\(\s*SELECT\b/g)) {
    const open = range[0] + match.index
    let close = open + 1
    while (masked[close] !== ')' || depth[close] !== depth[open]) close++
    statement(masked, depth, [open + 1, close], emit, false)
  }
}

function patchObjects(source) {
  const objects = new Set()
  const argument = (open, index) => {
    const parts = splitList(source, open, scanCode(source, open, ')'))
    if (!parts[index]) return
    const [from] = trim(source, parts[index])
    if (source[from] === '{') objects.add(from)
  }
  for (const call of source.matchAll(/(?<![\w.])set\(/g)) argument(call.index + call[0].length, 1)
  for (const match of source.matchAll(/: Patch<[^>]+>\s*(=|\{)/g)) {
    const at = match.index + match[0].length - 1
    if (match[1] === '=') {
      objects.add(trim(source, [at + 1, source.length])[0])
      continue
    }
    const body = [at + 1, scanCode(source, at + 1, '}')]
    for (const ret of source.slice(...body).matchAll(/\breturn \{/g)) {
      objects.add(body[0] + ret.index + ret[0].length - 1)
    }
  }
  for (const declaration of source.matchAll(/function (\w+)\(/g)) {
    const open = declaration.index + declaration[0].length
    const index = splitList(source, open, scanCode(source, open, ')')).findIndex(([from, to]) =>
      source.slice(from, to).includes('Patch<')
    )
    if (index < 0) continue
    for (const call of source.matchAll(
      new RegExp(`(?<![\\w.]|function )${declaration[1]}\\(`, 'g')
    )) {
      argument(call.index + call[0].length, index)
    }
  }
  return [...objects].filter((at) => source[at] === '{')
}

function mutantsOf(source, ordered) {
  const mutants = []
  const seen = new Map()
  const add = (fn, kind, shown, [start, end], replacement) => {
    const base = `${kind}: ${shown.replace(/\s+/g, ' ').trim()}`
    const count = (seen.get(`${fn}\t${base}`) ?? 0) + 1
    seen.set(`${fn}\t${base}`, count)
    mutants.push({
      function: fn,
      mutation: count === 1 ? base : `${base} #${count}`,
      source: source.slice(0, start) + replacement + source.slice(end),
    })
  }

  const callArguments = new Set()
  for (const call of source.matchAll(/(?<![\w.])(and|or)\(/g)) {
    const open = call.index + call[0].length
    const parts = splitList(source, open, scanCode(source, open, ')'))
    parts.forEach(([start, end], index) => {
      const [from, to] = trim(source, [start, end])
      const fragment = /^(?:[^`]*&&\s*)?sql`/.exec(source.slice(from, to))
      if (!fragment) return
      callArguments.add(from + fragment[0].length)
      const removed =
        index + 1 < parts.length
          ? [start, parts[index + 1][0]]
          : [parts[index - 1]?.[1] ?? start, end]
      add(
        declarationAt(source, from),
        `drop ${call[1]}() argument`,
        source.slice(from, to),
        removed,
        ''
      )
    })
  }

  for (const open of patchObjects(source)) {
    const close = scanCode(source, open + 1, '}')
    const parts = splitList(source, open + 1, close).map((part) => trim(source, part))
    parts.forEach(([from, to], index) => {
      const fn = declarationAt(source, from)
      const text = source.slice(from, to)
      const removed =
        source[to] === ',' ? [from, to + 1] : index > 0 ? [parts[index - 1][1], to] : [from, to]
      add(fn, 'drop SET assignment', text, removed, '')
      if (text.startsWith('...')) return
      const pair = /^(\w+)\s*:\s*([\s\S]+)$/.exec(text)
      if (pair && pair[2] !== 'null')
        add(fn, 'null SET value', text, [from, to], `${pair[1]}: null`)
      if (/^\w+$/.test(text)) add(fn, 'null SET value', text, [from, to], `${text}: null`)
    })
  }

  const members = enumMembers(source)
  for (const list of source.matchAll(/\[\s*((\w+)\.\w+\s*(?:,\s*\2\.\w+\s*)*),?\s*\]/g)) {
    const all = members.get(list[2])
    if (!all) continue
    const fn = declarationAt(source, list.index)
    const present = list[1].split(',').map((item) => item.trim().split('.')[1])
    const shown = `[${present.join(', ')}]`
    const at = [list.index, list.index + list[0].length]
    const render = (names) => `[${names.map((name) => `${list[2]}.${name}`).join(', ')}]`
    if (present.length > 1) {
      for (const name of present) {
        add(
          fn,
          `drop ${name} from status list`,
          shown,
          at,
          render(present.filter((other) => other !== name))
        )
      }
    }
    for (const name of all.filter((name) => !present.includes(name))) {
      add(fn, `add ${name} to status list`, shown, at, render([...present, name]))
    }
  }

  for (const call of source.matchAll(/(?<![\w.])(\w+)\.transaction\(/g)) {
    const open = call.index + call[0].length
    const close = scanCode(source, open, ')')
    add(
      declarationAt(source, call.index),
      'drop transaction',
      `${call[1]}.transaction`,
      [call.index, close + 1],
      `(${source.slice(open, close)})(${call[1]})`
    )
  }

  for (const tag of source.matchAll(/(?<![\w.])sql`/g)) {
    const start = tag.index + tag[0].length
    const { end, holes } = scanTemplate(source, start)
    const body = source.slice(start, end)
    const masked = mask(body, holes, start)
    const depth = depths(masked)
    const fn = declarationAt(source, start)
    const emit = (kind, shown, [from, to], replacement) =>
      add(fn, kind, body.slice(...shown), [start + from, start + to], replacement)
    statement(
      masked,
      depth,
      [0, masked.length],
      emit,
      /\.one\(\s*$/.test(source.slice(0, tag.index))
    )
    const unquoted = masked.replace(/'[^']*'/g, (literal) => ' '.repeat(literal.length))
    for (const match of unquoted.matchAll(OPERATOR)) {
      const operator = match[1]
      const end = match.index + operator.length
      const left = /[\w."]*$/.exec(unquoted.slice(0, match.index).trimEnd())[0]
      const right = /^\s*(\u0001+|[\w."]*)/.exec(unquoted.slice(end))
      const column = (token) => token.replaceAll('"', '').split('.').at(-1)
      const isOrdered = ordered.has(column(left)) || ordered.has(column(right[1]))
      const from = unquoted.slice(0, match.index).trimEnd().length - left.length
      for (const swap of SWAPS[operator]) {
        if (operator === '=' && swap !== '<>' && !isOrdered) continue
        emit(
          `swap ${operator} for ${swap}`,
          [from, end + right[0].length],
          [match.index, end],
          swap
        )
      }
    }
    const fragment =
      clauses(masked, depth, [0, masked.length]).length === 0 && COMPARISON.test(masked)
    if (fragment) {
      predicate(masked, depth, trim(masked, [0, masked.length]), emit)
      if (!callArguments.has(start))
        emit('replace predicate with TRUE', [0, body.length], [0, body.length], 'TRUE')
    }
  }
  return mutants
}

function outcome(test) {
  const run = spawnSync('npx', ['vitest', 'run', '--project', 'db', test], { encoding: 'utf8' })
  if (run.signal || run.error) throw new Error(`vitest did not finish: ${run.signal ?? run.error}`)
  if (run.status === 0) return 'passed'
  return /syntax error at or near/.test(run.stdout + run.stderr) ? 'invalid' : 'failed'
}

function testedModules(only) {
  const all = readdirSync('src/db')
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.slice(0, -'.ts'.length))
    .filter((name) => !KERNEL.has(name) && existsSync(`src/db/__tests__/${name}.db.test.ts`))
  const unknown = only.filter((name) => !all.includes(name))
  if (unknown.length > 0) throw new Error(`no db-tested module named ${unknown.join(', ')}`)
  return only.length > 0 ? only : all
}

const { values } = parseArgs({
  options: {
    module: { type: 'string', multiple: true, default: [] },
    out: { type: 'string', default: join(tmpdir(), 'db-mutants.tsv') },
    list: { type: 'boolean', default: false },
    modules: { type: 'boolean', default: false },
    shard: { type: 'string', default: '1/1' },
  },
})

const ordered = orderedColumns()
const mutantsIn = (name) => mutantsOf(readFileSync(`src/db/${name}.ts`, 'utf8'), ordered)

if (values.modules) {
  const jobs = testedModules(values.module).flatMap((module) => {
    const shards = Math.max(1, Math.ceil(mutantsIn(module).length / MUTANTS_PER_JOB))
    return Array.from({ length: shards }, (_, index) => ({
      module,
      shard: `${index + 1}/${shards}`,
    }))
  })
  console.log(JSON.stringify(jobs))
  process.exit(0)
}

const shard = /^(\d+)\/(\d+)$/.exec(values.shard)
if (!shard || Number(shard[1]) < 1 || Number(shard[1]) > Number(shard[2])) {
  throw new Error(`--shard takes k/n with 1 <= k <= n, not ${values.shard}`)
}
const inShard = (_, index) => index % Number(shard[2]) === Number(shard[1]) - 1

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {})

const rows = []
const problems = []
const started = Date.now()
for (const name of testedModules(values.module)) {
  const file = `src/db/${name}.ts`
  const test = `src/db/__tests__/${name}.db.test.ts`
  const original = readFileSync(file, 'utf8')
  const generated = mutantsOf(original, ordered)
  const mutants = generated.filter(inShard)
  if (values.list) {
    for (const mutant of mutants) console.log(`${name}\t${mutant.function}\t${mutant.mutation}`)
    continue
  }
  if (outcome(test) !== 'passed') throw new Error(`${test} fails before any mutation`)
  const moduleStarted = Date.now()
  try {
    for (const mutant of mutants) {
      writeFileSync(file, mutant.source)
      const result = outcome(test)
      const equivalent = EQUIVALENT.some(
        (entry) =>
          entry.module === name &&
          entry.function === mutant.function &&
          entry.mutation === mutant.mutation
      )
      const status = {
        failed: 'killed',
        invalid: 'invalid',
        passed: equivalent ? 'equivalent' : 'survived',
      }[result]
      const row = [name, mutant.function, mutant.mutation, status]
      if (status === 'survived') problems.push(row.join('\t'))
      if (status === 'invalid') problems.push(`${row.join('\t')}: the mutant is not valid SQL`)
      if (equivalent && result !== 'passed')
        problems.push(`${row.join('\t')}: allowlisted but killed`)
      rows.push(row)
      console.log(rows.at(-1).join('\t'))
    }
  } finally {
    writeFileSync(file, original)
  }
  if (readFileSync(file, 'utf8') !== original) throw new Error(`${file} was not restored`)
  console.log(
    `${name} shard ${values.shard}: ${mutants.length} of ${generated.length} mutants in ${((Date.now() - moduleStarted) / 1000).toFixed(1)}s`
  )
  for (const entry of EQUIVALENT.filter((entry) => entry.module === name)) {
    if (
      !generated.some(
        (mutant) => mutant.function === entry.function && mutant.mutation === entry.mutation
      )
    ) {
      problems.push(`${name}\t${entry.function}\t${entry.mutation}: allowlisted but not generated`)
    }
  }
}

if (!values.list) {
  const lines = [['module', 'function', 'mutation', 'status'], ...rows].map((row) => row.join('\t'))
  writeFileSync(values.out, `${lines.join('\n')}\n`)
  const tally = (status) => rows.filter((row) => row[3] === status).length
  console.log(
    `${rows.length} mutants in ${((Date.now() - started) / 1000).toFixed(1)}s: ${tally('killed')} killed, ${tally('equivalent')} equivalent, ${tally('invalid')} invalid, ${tally('survived')} survived. TSV: ${values.out}`
  )
  if (problems.length > 0) {
    console.error(
      `${problems.length} mutant problem(s). Kill each survivor with a test, or allowlist it in scripts/check-db-mutants.mjs with the reason it is equivalent:`
    )
    console.error(problems.join('\n'))
    process.exit(1)
  }
}
