import { Linter, type ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import lifecycleOwner from '../lifecycle-owner.mjs'

const linter = new Linter()
const config: Linter.Config = {
  files: ['**/*.ts'],
  plugins: { local: lifecycleOwner as ESLint.Plugin },
  rules: { 'local/lifecycle-owner': 'error' },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
}

const IMPORTS = [
  "import { db } from './pool'",
  "import { identifier, raw, sql } from './sql'",
  "import * as tableHelpers from './table'",
  "import { col, defineTable, insert, select, selectAll, set } from './table'",
  "import { deleteEveryRow } from './wipe'",
  "import { submissionBirth, submissionDetails, submissions } from './tables'",
  "import { SubmissionStatus } from './types'",
  '',
].join('\n')

function violations(code: string, imports = IMPORTS, filename = 'src/db/probe.ts'): string[] {
  return linter
    .verify(`${imports}${code}`, config, filename)
    .map((message) => message.messageId ?? '')
    .sort()
}

function expectEach(cases: Record<string, string[]>): void {
  for (const [code, expected] of Object.entries(cases)) {
    expect(violations(code), code).toEqual(expected)
  }
}

describe('local/lifecycle-owner', () => {
  it('flags every write through the submissions descriptor, whatever helper or alias carries it', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET ${set(submissions, { status })} WHERE id = ${id}`)': [
        'descriptor',
        'interpolation',
      ],
      'db.affected(sql`UPDATE submissions SET ${set(submissions, { ...input, status: SubmissionStatus.DENIED })} WHERE id = ${id}`)':
        ['descriptor', 'interpolation'],
      'const patch = { ...input, status: SubmissionStatus.APPROVED }\ndb.affected(sql`UPDATE submissions SET ${set(submissions, patch)} WHERE id = ${id}`)':
        ['descriptor', 'interpolation'],
      'const table = submissions\ndb.affected(sql`UPDATE submissions SET ${set(table, { status })} WHERE id = ${id}`)':
        ['descriptor', 'interpolation'],
      'db.affected(sql`UPDATE submissions SET ${tableHelpers.set(submissions, { status })} WHERE id = ${id}`)':
        ['descriptor', 'interpolation'],
      'db.affected(insert(submissions, { ...row, stripeRefundId: refund }))': ['descriptor'],
      'const values = { ...row, stripeRefundId: refund }\ndb.affected(insert(submissions, values))':
        ['descriptor'],
      'db.affected(insert(submissions, { ...row }))': ['descriptor'],
      'db.affected(insert(submissions, submission))': ['descriptor'],
      'function updateRow(table, id, patch) {\n  return sql`UPDATE ${identifier(table.name)} SET ${set(table, patch)} WHERE id = ${id}`\n}\ndb.affected(updateRow(submissions, id, { status: SubmissionStatus.APPROVED }))':
        ['descriptor'],
      'function updateRow(table, id, patch) {\n  return sql`UPDATE ${identifier(table.name)} SET ${set(table, patch)} WHERE id = ${id}`\n}\ndb.affected(updateRow(submissions, id, { stripeRefundId: refund, refundedAt: new Date() }))':
        ['descriptor'],
      'function updateSubmission(id, patch) {\n  return sql`UPDATE submissions SET ${set(submissions, patch)} WHERE id = ${id}`\n}\ndb.affected(updateSubmission(id, { status: SubmissionStatus.MAYBE }))':
        ['descriptor', 'interpolation'],
      'db.affected(sql`${insert(submissions, row)} ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = EXCLUDED.status`)':
        ['descriptor', 'lifecycle'],
      'const name = submissions.name': ['descriptor'],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${reason}, ${raw(column)} = ${status} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE submissions SET denial_reason = COALESCE(${a}, ${b}), ${identifier(column)} = ${value} WHERE id = ${id}`)':
        ['interpolation'],
      'export { submissions }': ['descriptor'],
      'export const subs = submissions': ['descriptor'],
    })
  })

  it('flags a descriptor that reaches a helper other than the imported select, selectAll or deleteEveryRow', () => {
    expectEach({
      'const wiped = tableHelpers.selectAll(submissions)': ['descriptor'],
      'const rows = selectAll(users, submissions)': ['descriptor'],
      'const state = select(submissions, ["status"], { alias: "s" })': [],
    })
    expect(
      violations(
        'function deleteEveryRow(table) {\n  return db.affected(insert(table, { status }))\n}\ndeleteEveryRow(submissions)',
        "import { insert } from './table'\nimport { submissions } from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const wiped = deleteEveryRow(submissions)',
        "import { deleteEveryRow } from './table-tools'\nimport { submissions } from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = select(submissions, ["id"])',
        "import { select } from '@/lib/table'\nimport { submissions } from '@/db/tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = select(submissions, ["id"])',
        "import { select } from '@/db/table'\nimport { submissions } from '@/db/tables'\n"
      )
    ).toEqual([])
    expect(
      violations(
        'const state = pick(submissions, ["status"])',
        "import { select as pick } from './table'\nimport { submissions } from './tables'\n"
      )
    ).toEqual([])
  })

  it('flags a renamed or namespaced import of the descriptor', () => {
    expect(
      violations(
        'db.affected(sql`UPDATE submissions SET ${set(subs, { status })} WHERE id = ${id}`)',
        "import { set } from './table'\nimport { sql } from './sql'\nimport { submissions as subs } from './tables'\n"
      )
    ).toEqual(['descriptor', 'descriptor', 'interpolation'])
    expect(
      violations(
        'db.affected(insert(subs, { ...row, stripeRefundId: refund }))',
        "import { insert } from './table'\nimport { submissions as subs } from './tables'\n"
      )
    ).toEqual(['descriptor', 'descriptor'])
    expect(
      violations(
        'db.affected(sql`UPDATE submissions SET ${set(tables.submissions, { status })} WHERE id = ${id}`)',
        "import { set } from './table'\nimport { sql } from './sql'\nimport * as tables from './tables'\n"
      )
    ).toEqual(['descriptor', 'interpolation'])
    expect(
      violations('const table = tables.submissions', "import { tables } from '@/db/tables'\n")
    ).toEqual(['descriptor'])
    expect(
      violations(
        'db.affected(insert(subs, row))',
        "import { insert } from './table'\nimport { submissions as subs } from './tables.ts'\n"
      )
    ).toEqual(['descriptor', 'descriptor'])
    expect(
      violations(
        'const rows = selectAll(submissions)',
        "import { selectAll } from './table'\nimport { submissions } from '../db/tables.mjs'\n"
      )
    ).toEqual([])
    expect(
      violations('const ids = select(tables.users, ["id"])', "import * as tables from './tables'\n")
    ).toEqual([])
  })

  it('flags the tables module leaving its import by name: destructured, aliased, indexed, re-exported or loaded with import()', () => {
    const NAMESPACE = "import * as tables from './tables'\nimport { insert } from './table'\n"
    expect(
      violations(
        'const { submissions: table } = tables\ndb.affected(insert(table, { ...row, stripeRefundId: refund }))',
        NAMESPACE
      )
    ).toEqual(['module'])
    expect(violations('const copy = tables', NAMESPACE)).toEqual(['module'])
    expect(violations('const table = tables[name]', NAMESPACE)).toEqual(['module'])
    expect(
      violations('const { submissions } = tables', "import { tables } from './tables'\n")
    ).toEqual(['module'])
    expect(violations("export { submissions } from './tables'", '')).toEqual(['module'])
    expect(violations("export * from './tables'", '')).toEqual(['module'])
    expect(violations("export * from './tables.js'", '')).toEqual(['module'])
    expect(violations("const tables = require('@/db/tables.cjs')", '')).toEqual(['module'])
    expect(violations("export * as tables from '@/db/tables'", '')).toEqual(['module'])
    expect(violations("const { submissions: table } = await import('./tables')", '')).toEqual([
      'module',
    ])
    expect(violations("const { submissions } = require('./tables')", '')).toEqual(['module'])
    expect(violations("export { findSubmissionById } from './submissions'", '')).toEqual([])
  })

  it('flags a second descriptor of the submissions table outside src/db/tables.ts', () => {
    expectEach({
      "const mine = defineTable('submissions', { id: col('id', 'text'), status: col('status', 'enum') })":
        ['definition'],
      "const mine = tableHelpers.defineTable('public.submissions', { id: col('id', 'text') })": [
        'definition',
      ],
      'const mine = defineTable(`Submissions`, { id: col(`id`, `text`) })': ['definition'],
      'const mine = defineTable(\'"public"."submissions"\', { id: col("id", "text") })': [
        'definition',
      ],
      "const archive = defineTable('submissions_archive', { id: col('id', 'text') })": [],
      "const name = 'submissions'\nconst mine = defineTable(name, { id: col('id', 'text') })": [],
    })
    expect(
      violations(
        "export const submissions = defineTable('submissions', { id: col('id', 'text') })",
        "import { col, defineTable } from './table'\n",
        'src/db/tables.ts'
      )
    ).toEqual([])
    expect(
      violations(
        "export const submissions = defineTable('submissions', { id: col('id', 'text') })",
        "import { col, defineTable } from '@/db/table'\n",
        'src/lib/tables.ts'
      )
    ).toEqual(['definition'])
  })

  it('flags (1) an UPDATE of submissions whose SET clause names status or a refund column: any case, schema, quoting, alias, ONLY, star, layout or statement', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET status = ${status} WHERE id = ${id}`)': ['lifecycle'],
      'db.affected(sql`update submissions set status = ${status} where id = ${id}`)': ['lifecycle'],
      'db.affected(sql`UPDATE public.submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE public . submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE "public" . "submissions" SET refunded_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE "submissions" SET refunded_at = now() RETURNING id`)': ['lifecycle'],
      'db.affected(sql`UPDATE submissions s SET status = ${status} WHERE s.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions AS s SET refunded_at = now() WHERE s.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions AS "s" SET status = ${status} WHERE "s".id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions "s" SET status = ${status} WHERE "s".id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE ONLY submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions * SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE ONLY submissions* AS s SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions /* reset */ SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE /* all */ ONLY submissions -- reset\n AS s /* alias */ SET status = ${status} WHERE s.id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`\n    UPDATE submissions\n    SET status = ${status}\n    WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = NULL WHERE id = ${id}; UPDATE submissions SET stripe_refund_id = ${refund} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET updated_at = ${at}, stripe_refund_id = ${refund} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET (status, denial_reason) = (${status}, ${reason}) WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`WITH moved AS (UPDATE submissions SET status = ${status} WHERE id = ${id} RETURNING id) SELECT count(*) FROM moved`)':
        ['lifecycle'],
      "const q = 'UPDATE submissions SET status = $1'": ['lifecycle'],
      "const text = 'UPDATE submissions SET ' + 'status = $1 WHERE id = $2'": ['lifecycle'],
    })
  })

  it('reads the SET clause of (1) past string literals, dollar quotes, comments, subqueries and IS DISTINCT FROM', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET denial_reason = (SELECT email FROM users WHERE id = ${reasonId}), status = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'Denied WHERE required', status = ${status} WHERE id = ${id}`)":
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'a; b', status = ${status} WHERE id = ${id}`)":
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'came FROM review', refunded_at = now() WHERE id = ${id}`)":
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'it''s where', status = ${s} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = $$from where$$, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = $note$ returning $note$, refunded_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${a}, (status, maybe_reason) = (${s}, ${b}) WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${a} /* WHERE */, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${a} -- RETURNING\n, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET maybe_reason = CASE WHEN ${a} IS DISTINCT FROM ${b} THEN ${a} END, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET maybe_reason = CASE WHEN ${a} IS NOT DISTINCT FROM ${b} THEN ${a} END, refunded_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'status: closed' WHERE id = ${id}`)":
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = (SELECT status FROM users WHERE id = ${a}) WHERE id = ${id}`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = r.reason FROM reviews r WHERE r.status = ${s} AND submissions.id = r.id`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = NULL WHERE status = ${s} RETURNING status`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = NULL RETURNING status, refunded_at`)':
        [],
      "const q = 'UPDATE submissions SET denial_reason = NULL; SELECT status FROM submissions'": [],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${a}, updated_at = now() WHERE id = ${id}`)':
        [],
    })
  })

  it('flags (2) an INSERT INTO submissions with no column list or a column list naming a refund column', () => {
    expectEach({
      'db.affected(sql`INSERT INTO submissions (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      "const q = 'INSERT INTO submissions(id, refunded_at) VALUES ($1, $2)'": ['lifecycle'],
      'db.affected(sql`INSERT INTO "public"."submissions" ("id", "refunded_at") VALUES (${id}, now())`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions AS s (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO ${identifier("submissions")} (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions/* cols */(id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`INSERT /* row */ INTO submissions (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions SELECT * FROM submissions_import WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions VALUES (${id}, ${refund})`)': ['lifecycle'],
      "const q = 'insert into public.submissions default values'": ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions (id, status) VALUES (${id}, ${s})`)': [],
      'db.affected(sql`INSERT INTO submissions AS s (id, status) SELECT id, status FROM staged`)':
        [],
      'db.affected(sql`INSERT INTO submissions_archive SELECT * FROM submissions WHERE id = ${id}`)':
        [],
    })
  })

  it('flags (3) a DO UPDATE SET naming status or a refund column, whatever table its statement inserts into', () => {
    expectEach({
      'db.affected(sql`${insert(submissionBirth, row)} ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = EXCLUDED.status`)':
        ['lifecycle'],
      "const q = 'INSERT INTO submissions (id, status) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET refunded_at = now()'":
        ['lifecycle'],
      "const q = 'INSERT INTO sms_support_jobs (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET status = $2'":
        ['lifecycle'],
      "const q = 'INSERT INTO other (a) VALUES (1) ON CONFLICT (a) DO UPDATE SET a = 1; INSERT INTO submissions (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET status = $2'":
        ['lifecycle'],
      "db.affected(sql`INSERT INTO submissions (id, status) VALUES (${id}, 'PENDING_REVIEW') ON CONFLICT (id) DO UPDATE SET denial_reason = (SELECT email FROM users WHERE id = 'nobody'), status = 'DENIED'`)":
        ['lifecycle'],
      'db.affected(sql`${insert(smsPhoneStates, { phoneE164 })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsPhoneStates, { optedOutAt })}`)':
        [],
      "const q = 'INSERT INTO submissions (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET denial_reason = $2 WHERE submissions.status = $3'":
        [],
    })
  })

  it('flags (4) a MERGE INTO submissions whatever it sets', () => {
    expectEach({
      'db.affected(sql`MERGE INTO submissions AS s USING (SELECT ${id}::text AS id) AS src ON s.id = src.id WHEN MATCHED THEN UPDATE SET status = ${status}`)':
        ['merge'],
      'db.affected(sql`MERGE INTO "public"."submissions" s USING staged ON s.id = staged.id WHEN MATCHED THEN UPDATE SET denial_reason = staged.reason`)':
        ['merge'],
      "const q = 'merge into submissions s using staged on s.id = staged.id when not matched then insert (id) values (staged.id)'":
        ['merge'],
      'db.affected(sql`MERGE INTO submissions_archive s USING staged ON s.id = staged.id WHEN MATCHED THEN UPDATE SET status = staged.status`)':
        [],
    })
  })

  it('flags (5) an interpolation in column position of a submissions SET clause other than set(submissionDetails, ...)', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET denial_reason = ${reason}, ${raw(column)} = ${status} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE submissions SET denial_reason = COALESCE(${a}, ${b}), ${identifier(column)} = ${value} WHERE id = ${id}`)':
        ['interpolation'],
      "const text = 'UPDATE submissions SET ' + column + ' = $1 WHERE id = $2'": ['interpolation'],
      'db.affected(sql`UPDATE submissions SET ${other`status = ${s}`} WHERE id = ${id}`)': [
        'interpolation',
      ],
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, { ...row })} WHERE id = ${id}`)':
        [],
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, patch)}, updated_at = ${at} WHERE id = ${id} AND status = ${s}`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = COALESCE(${a}, ${b}), maybe_reason = ${c} WHERE id = ${id}`)':
        [],
    })
  })

  it('reads string-literal identifier() and raw() arguments and nested sql fragments as SQL text, reporting a nested statement once', () => {
    expectEach({
      'db.affected(sql`UPDATE ${identifier("submissions")} SET status = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE ${raw(`public.submissions`)} SET refunded_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET ${identifier("status")} = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`${raw("UPDATE")} submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions ${sql`SET status = ${status}`} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`${sql`UPDATE submissions SET status = ${status}`} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      "db.affected('UPDATE submissions ' + sql`SET refunded_at = ${at}`)": ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET ${sql`${raw(column)} = ${value}`} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE submissions ${sql`SET ${set(submissionDetails, patch)}`} WHERE id = ${id}`)':
        [],
    })
  })

  it('pins the round-3 verifier probes: each write the row lists is flagged, the rest pass unclaimed', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET denial_reason = (SELECT email FROM users WHERE id = ${reasonId}), status = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'Denied WHERE required', status = ${status} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions AS "s" SET status = ${status} WHERE "s".id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`INSERT INTO submissions SELECT * FROM submissions_import WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions ${sql`SET status = ${status}`} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      "db.affected(sql`UPDATE submissions SET denial_reason = 'a; b', status = ${status} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`${raw("UPDATE")} submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`INSERT INTO ${identifier("submissions")} (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions/* cols */(id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE public . submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions * SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions SET (status, denial_reason) = (${status}, ${reason}) WHERE id = ${id}`)':
        ['lifecycle'],
      "db.affected(sql`INSERT INTO submissions (id, stripe_payment_intent_id, payment_amount, status, state, recipient, patient_first_name, patient_last_name, patient_date_of_birth, email, phone, note_purpose, first_day_off, last_day_off, absence_reason, symptoms, created_at, updated_at) VALUES (${id}, ${id}, 2495, 'PENDING_REVIEW', 'CA', 'employer', 'Pat', ${id}, '1990-01-01', ${id}, '+15555550123', 'work', current_date, current_date, 'illness', '[]'::jsonb, now(), now()) ON CONFLICT (id) DO UPDATE SET denial_reason = (SELECT email FROM users WHERE id = 'nobody'), status = 'DENIED'`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${reason} WHERE id = ${id}; UPDATE submissions SET status = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      "const verb = 'UPDATE'\ndb.affected(sql`${raw(verb)} submissions SET status = ${status} WHERE id = ${id}`)":
        [],
      'db.affected(sql`UPDATE submissions SET (${identifier(column)}, denial_reason) = (${value}, ${reason}) WHERE id = ${id}`)':
        [],
      "const text = ['UPDATE submissions', 'SET status = $1', 'WHERE id = $2'].join(' ')\ndb.affected(sql`${raw(text)}`)":
        [],
    })
    expect(
      violations(
        'db.affected(insert(submissions, { ...row, stripeRefundId: refund }))',
        "import { db } from './pool'\nimport { insert } from './table'\nimport { submissions } from './tables.js'\n"
      )
    ).toEqual(['descriptor'])
    expect(violations("export { submissions as subs } from './tables'", '')).toEqual(['module'])
  })

  it('passes SQL whose table or column name is held in a variable', () => {
    expectEach({
      "const table = 'submissions'\ndb.affected(sql`UPDATE ${raw(table)} SET stripe_refund_id = ${refund} WHERE id = ${id}`)":
        [],
    })
  })

  it('allows reads, detail writes, birth rows and other tables', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, { status: SubmissionStatus.APPROVED })} WHERE id = ${id}`)':
        [],
      'db.affected(sql`SELECT ${select(submissions, ["id", "status"])} FROM submissions WHERE status = ${s}`)':
        [],
      'db.one(sql`SELECT ${selectAll(submissions)} FROM submissions WHERE refunded_at IS NOT NULL`)':
        [],
      'db.one(sql`SELECT ${selectAll(submissions)} FROM ${identifier("submissions")} WHERE id = ${id}`)':
        [],
      'const state = select(submissions, ["status", "refundedAt"], { alias: "s" })': [],
      'const wiped = deleteEveryRow(submissions)': [],
      'db.affected(sql`${insert(submissionBirth, submission)} ON CONFLICT (stripe_payment_intent_id) DO NOTHING RETURNING ${selectAll(submissions)}`)':
        [],
      'db.affected(insert(submissionBirth, { status }))': [],
      'db.affected(sql`UPDATE sms_support_jobs SET status = ${s} WHERE id = ${id}`)': [],
      'db.affected(sql`UPDATE submissions_archive SET status = ${s}`)': [],
      "const copy = 'Update submissions, then set the status filter'": [],
    })
  })
})
