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

  it('flags SQL text that writes status or a refund column: any case, schema, alias, ONLY, comment, statement, interpolated name or DO UPDATE SET of any table', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET status = ${status} WHERE id = ${id}`)': ['lifecycle'],
      'db.affected(sql`update submissions set status = ${status} where id = ${id}`)': ['lifecycle'],
      'db.affected(sql`UPDATE public.submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions s SET status = ${status} WHERE s.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions AS s SET refunded_at = now() WHERE s.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE ONLY submissions SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE submissions /* reset */ SET status = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE /* all */ ONLY submissions -- reset\n AS s /* alias */ SET status = ${status} WHERE s.id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE ${identifier("submissions")} SET status = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE ${raw(`public.submissions`)} SET refunded_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET ${identifier("status")} = ${status} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET ${raw("status")} = ${status} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`\n    UPDATE submissions\n    SET status = ${status}\n    WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET denial_reason = NULL WHERE id = ${id}; UPDATE submissions SET stripe_refund_id = ${refund} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE submissions SET updated_at = ${at}, stripe_refund_id = ${refund} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE "submissions" SET refunded_at = now() RETURNING id`)': ['lifecycle'],
      "const q = 'UPDATE submissions SET status = $1'": ['lifecycle'],
      "const text = 'UPDATE submissions SET ' + 'status = $1 WHERE id = $2'": ['lifecycle'],
      'db.affected(sql`INSERT INTO submissions (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        ['lifecycle'],
      "const q = 'INSERT INTO submissions(id, refunded_at) VALUES ($1, $2)'": ['lifecycle'],
      'db.affected(sql`${insert(submissionBirth, row)} ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = EXCLUDED.status`)':
        ['lifecycle'],
      "const q = 'INSERT INTO submissions (id, status) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET refunded_at = now()'":
        ['lifecycle'],
      "const q = 'INSERT INTO sms_support_jobs (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET status = $2'":
        ['lifecycle'],
      "const q = 'INSERT INTO other (a) VALUES (1) ON CONFLICT (a) DO UPDATE SET a = 1; INSERT INTO submissions (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET status = $2'":
        ['lifecycle'],
      'db.affected(sql`MERGE INTO submissions AS s USING (SELECT ${id}::text AS id) AS src ON s.id = src.id WHEN MATCHED THEN UPDATE SET status = ${status}`)':
        ['merge'],
      'db.affected(sql`MERGE INTO "public"."submissions" s USING staged ON s.id = staged.id WHEN MATCHED THEN UPDATE SET denial_reason = staged.reason`)':
        ['merge'],
      "const q = 'merge into submissions s using staged on s.id = staged.id when not matched then insert (id) values (staged.id)'":
        ['merge'],
    })
  })

  it('does not see a table name held in a variable or a SQL comment anywhere except between UPDATE and SET', () => {
    expectEach({
      "const table = 'submissions'\ndb.affected(sql`UPDATE ${raw(table)} SET stripe_refund_id = ${refund} WHERE id = ${id}`)":
        [],
      'db.affected(sql`INSERT /* row */ INTO submissions (id, stripe_refund_id) VALUES (${id}, ${refund})`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = ${a} /* WHERE */, status = ${s} WHERE id = ${id}`)':
        [],
    })
  })

  it('allows reads, detail writes, birth rows and other tables', () => {
    expectEach({
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, { ...row })} WHERE id = ${id}`)':
        [],
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, { status: SubmissionStatus.APPROVED })} WHERE id = ${id}`)':
        [],
      'db.affected(sql`UPDATE submissions SET ${set(submissionDetails, patch)} WHERE id = ${id} AND status = ${s}`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = NULL WHERE status = ${s} RETURNING status`)':
        [],
      'db.affected(sql`UPDATE submissions SET denial_reason = COALESCE(${a}, ${b}), maybe_reason = ${c} WHERE id = ${id}`)':
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
      'db.affected(sql`INSERT INTO submissions (id, status) VALUES (${id}, ${s})`)': [],
      'db.affected(sql`UPDATE sms_support_jobs SET status = ${s} WHERE id = ${id}`)': [],
      'db.affected(sql`${insert(smsPhoneStates, { phoneE164 })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsPhoneStates, { optedOutAt })}`)':
        [],

      'db.affected(sql`UPDATE submissions_archive SET status = ${s}`)': [],
      'db.affected(sql`MERGE INTO submissions_archive s USING staged ON s.id = staged.id WHEN MATCHED THEN UPDATE SET status = staged.status`)':
        [],
      "const copy = 'Update submissions, then set the status filter'": [],
    })
  })
})
