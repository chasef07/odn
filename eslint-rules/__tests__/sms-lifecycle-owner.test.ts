import * as parser from '@typescript-eslint/parser'
import { Linter, type ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import smsLifecycleOwner from '../sms-lifecycle-owner.mjs'

const linter = new Linter()
const config: Linter.Config = {
  files: ['**/*.ts'],
  plugins: { local: smsLifecycleOwner as ESLint.Plugin },
  rules: { 'local/sms-lifecycle-owner': 'error' },
  languageOptions: { parser, ecmaVersion: 2024, sourceType: 'module' },
}

const IMPORTS = [
  "import { db } from './pool'",
  "import { identifier, join, raw, sql } from './sql'",
  "import { defineTable, insert, select, selectAll, set } from './table'",
  "import { deleteEveryRow } from './wipe'",
  "import { smsPhoneStates, smsSupportJobs, smsSupportTicketDetails, smsSupportTickets } from './tables'",
  '',
].join('\n')

function violations(code: string, imports = IMPORTS, filename = 'src/db/module.ts'): string[] {
  return linter
    .verify(`${imports}${code}`, config, { filename })
    .map((message) => message.messageId ?? message.message)
    .sort()
}

function expectEach(cases: Record<string, string[]>): void {
  for (const [code, expected] of Object.entries(cases)) {
    expect(violations(code), code).toEqual(expected)
  }
}

describe('local/sms-lifecycle-owner', () => {
  it('flags SQL text that writes a ticket status column: any case, schema, quoting, alias or layout', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET status = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`update sms_support_tickets set state = ${s} where id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE public.sms_support_tickets SET automation_status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE "public"."sms_support_tickets" SET closed_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE "sms_support_tickets" SET "status" = ${s} RETURNING id`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets t SET status = ${s} WHERE t.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets AS t SET closed_at = now() WHERE t.id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE ONLY sms_support_tickets SET status = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`\n    UPDATE sms_support_tickets\n    SET last_outbound_at = now(),\n      status = ${s}\n    WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = now() WHERE id = ${id}; UPDATE sms_support_tickets SET state = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET (status, state) = (${s}, ${t}) WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`WITH moved AS (UPDATE sms_support_tickets SET status = ${s} WHERE id = ${id} RETURNING id) SELECT count(*) FROM moved`)':
        ['lifecycle'],
      "const q = 'UPDATE sms_support_tickets SET status = $1 WHERE id = $2'": ['lifecycle'],
      "const q = 'UPDATE sms_support_tickets SET ' + 'automation_status = $1 WHERE id = $2'": [
        'lifecycle',
      ],
    })
  })

  it('reads the SET clause past string literals, dollar quotes, comments and subqueries', () => {
    expectEach({
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'Moved from automation', status = ${s} WHERE id = ${id}`)":
        ['lifecycle'],
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'Customer returning soon', state = ${s} WHERE id = ${id}`)":
        ['lifecycle'],
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'it''s where', status = ${s} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = $$from where$$, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = $note$ returning $note$, closed_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET retry_count = (SELECT count(*) FROM sms_support_jobs WHERE ticket_id = ${id}), status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets -- close it\nSET status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets /* close it */ SET status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'Where it is returning from', last_outbound_at = now() WHERE id = ${id} AND status = ${s}`)":
        [],
      "db.affected(sql`UPDATE sms_support_tickets SET retry_count = (SELECT count(*) FROM sms_support_jobs WHERE status = 'DONE' AND ticket_id = ${id}) WHERE id = ${id}`)":
        [],
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'status: closed' WHERE id = ${id}`)":
        [],
    })
  })

  it('flags every ticket insert and a DO UPDATE SET of a status column on a ticket or unknown target', () => {
    expectEach({
      'db.affected(sql`INSERT INTO sms_support_tickets (id, phone_e164) VALUES (${id}, ${phone})`)':
        ['lifecycle'],
      "const q = 'insert into public.sms_support_tickets(id) values ($1)'": ['lifecycle'],
      'db.affected(sql`INSERT INTO "sms_support_tickets" (id) VALUES (${id})`)': ['lifecycle'],
      'db.affected(sql`${raw("x")} ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`)': [
        'lifecycle',
      ],
      "const q = 'INSERT INTO sms_messages (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET status = $2'":
        [],
      'db.affected(sql`${raw("x")} ON CONFLICT (id) DO UPDATE SET last_outbound_at = now()`)': [],
    })
  })

  it('flags every write to sms_support_jobs and no read of it', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_jobs SET locked_at = ${at} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`update public.sms_support_jobs j set attempts = attempts + 1 where j.id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE "sms_support_jobs" AS j SET last_error = NULL WHERE j.id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`INSERT INTO sms_support_jobs (id, ticket_id) VALUES (${id}, ${ticket})`)': [
        'lifecycle',
      ],
      'db.one(sql`WITH j AS (INSERT INTO sms_support_jobs (id) VALUES (${id}) RETURNING id) SELECT id FROM j`)':
        ['lifecycle'],
      "const q = 'INSERT INTO sms_support_jobs (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET locked_at = $2'":
        ['lifecycle'],
      'db.affected(sql`DELETE FROM sms_support_jobs WHERE ticket_id = ${id}`)': ['lifecycle'],
      'db.affected(sql`DELETE FROM sms_support_tickets WHERE id = ${id}`)': ['lifecycle'],
      'db.affected(sql`MERGE INTO sms_support_jobs j USING (SELECT ${id}::text AS id) s ON j.id = s.id WHEN MATCHED THEN UPDATE SET status = ${s}`)':
        ['merge'],
      'db.affected(sql`MERGE INTO public.sms_support_tickets t USING (SELECT ${id}::text AS id) s ON t.id = s.id WHEN MATCHED THEN UPDATE SET status = ${s}`)':
        ['merge'],
      'db.affected(sql`MERGE INTO sms_messages m USING (SELECT ${id}::text AS id) s ON m.id = s.id WHEN MATCHED THEN UPDATE SET status = ${s}`)':
        [],
      'db.affected(sql`${raw("x")} ON CONFLICT (id) DO UPDATE SET locked_at = now()`)': [],
      'db.many(sql`SELECT id FROM sms_support_jobs WHERE status = ${s}`)': [],
      'db.affected(sql`UPDATE sms_support_jobs_archive SET status = ${s}`)': [],
      'db.affected(sql`DELETE FROM sms_messages WHERE id = ${id}`)': [],
    })
  })

  it('reads a static identifier() or raw() argument as SQL text', () => {
    expectEach({
      "db.affected(sql`UPDATE ${identifier('sms_support_tickets')} SET status = ${s} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE ${raw(`sms_support_jobs`)} SET locked_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${raw("status")} = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      "db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${raw(\"'Closed', status = 'CLOSED'\")} WHERE id = ${id}`)":
        ['lifecycle'],
      'db.affected(sql`UPDATE ${identifier(smsSupportTicketDetails.name)} SET status = ${s} WHERE id = ${id}`)':
        [],
    })
  })

  it('flags an interpolated column in a ticket SET clause unless it is set(smsSupportTicketDetails, ...)', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET ${assignments} WHERE id = ${id}`)': [
        'interpolation',
      ],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = now(), ${identifier(column)} = ${value} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE sms_support_tickets SET failure_reason = COALESCE(${a}, ${b}), ${raw(c)} = ${v} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${join([sql`status = ${s}`, sql`state = ${t}`], ", ")} WHERE id = ${id}`)':
        ['interpolation'],
      "db.query('UPDATE sms_support_tickets SET ' + column + ' = $1 WHERE id = $2', [v, id])": [
        'interpolation',
      ],
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { failureReason: null })} WHERE id = ${id} AND status = ${s}`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets t SET ${set(smsSupportTicketDetails, patch)}, last_outbound_at = now() WHERE t.id = ${id}`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = ${at} WHERE id = ${id} AND status = ${s} RETURNING status`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = ${at}, failure_reason = COALESCE(${a}, ${b}) WHERE id = ${id}`)':
        [],
      "db.query('UPDATE sms_support_tickets SET last_outbound_at = ' + at + ' WHERE id = $1', [id])":
        [],
    })
  })

  it('refuses raw() anywhere inside a ticket SET clause', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${raw(text)} WHERE id = ${id}`)':
        ['raw'],
      'db.affected(sql`UPDATE sms_support_tickets SET failure_reason = COALESCE(${raw(text)}, NULL) WHERE id = ${id}`)':
        ['raw'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: raw(text) })} WHERE id = ${id}`)':
        ['raw'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: sql`${raw(text)}` })} WHERE id = ${id}`)':
        ['raw'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: raw(a), failureReason: raw(b) })} WHERE id = ${id}`)':
        ['raw', 'raw'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${text} WHERE id = ${raw(where)}`)':
        [],
      'db.affected(sql`UPDATE sms_messages SET body = ${raw(text)} WHERE id = ${id}`)': [],
    })
  })

  it('flags the ticket and job descriptors anywhere but the first argument of a read or wipe helper', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, patch)} WHERE id = ${id}`)':
        ['descriptor', 'interpolation'],
      'db.affected(sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, patch)} WHERE id = ${id}`)':
        ['descriptor', 'lifecycle'],
      'db.one(sql`${insert(smsSupportTickets, row)} RETURNING ${selectAll(smsSupportTickets)}`)': [
        'descriptor',
      ],
      'db.one(sql`${insert(smsSupportJobs, row)} ON CONFLICT DO NOTHING RETURNING id`)': [
        'descriptor',
      ],
      'const keys = smsSupportTickets.keys': ['descriptor'],
      'const table = smsSupportJobs': ['descriptor'],
      'const columns = select(row, smsSupportTickets.keys)': ['descriptor'],
      'db.many(sql`SELECT ${selectAll(smsSupportTickets, { alias: "t" })} FROM sms_support_tickets t WHERE t.status = ${s}`)':
        [],
      'db.many(sql`SELECT ${select(smsSupportJobs, ["id", "status"])} FROM sms_support_jobs WHERE ticket_id = ${id}`)':
        [],
      'const wiped = deleteEveryRow(smsSupportJobs)': [],
      'const tickets = deleteEveryRow(smsSupportTickets)': [],
      'const patch = set(smsSupportTicketDetails, { failureReason: null })': [],
      'db.affected(sql`${insert(smsPhoneStates, { phoneE164 })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsPhoneStates, { optedOutAt })}`)':
        [],
    })
  })

  it('accepts a read helper only when it is the one imported from the table or wipe module', () => {
    expect(
      violations(
        'function select<D>(table: D): D { return table }\nconst rows = select(smsSupportTickets)',
        "import { smsSupportTickets } from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = selectAll(smsSupportJobs)',
        "import { selectAll } from './sms-fixtures'\nimport { smsSupportJobs } from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = selectAll(smsSupportJobs)',
        "import { selectAll } from '@/db/table'\nimport { smsSupportJobs } from '@/db/tables'\n"
      )
    ).toEqual([])
    expect(
      violations(
        'const wiped = deleteEveryRow(smsSupportTickets)',
        "import { deleteEveryRow } from '@/db/wipe'\nimport { smsSupportTickets } from './tables'\n"
      )
    ).toEqual([])
  })

  it('flags a renamed, namespaced or aggregate access to a descriptor', () => {
    expect(
      violations(
        'const rows = select(t, ["id"])',
        "import { select } from './table'\nimport { smsSupportTickets as t } from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'db.affected(sql`UPDATE sms_support_jobs SET ${set(jobs, patch)}`)',
        "import { set } from './table'\nimport { sql } from './sql'\nimport { smsSupportJobs as jobs } from '../tables'\n"
      )
    ).toEqual(['descriptor', 'descriptor', 'lifecycle'])
    expect(
      violations(
        'const rows = select(x.smsSupportJobs, ["id"])',
        "import { select } from './table'\nimport * as x from './tables'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations('const table = tables.smsSupportTickets', "import { tables } from '@/db/tables'\n")
    ).toEqual(['descriptor'])
    expect(
      violations("const table = x['smsSupportJobs']", "import * as x from './tables'\n")
    ).toEqual(['descriptor'])
    expect(violations("const table = x['smsMessages']", "import * as x from './tables'\n")).toEqual(
      []
    )
    expect(
      violations(
        'const details = x.smsSupportTicketDetails\nconst other = tables.smsMessages',
        "import * as x from './tables'\nimport { tables } from '@/db/tables'\n"
      )
    ).toEqual([])
    expect(
      violations(
        'const keys = smsSupportTickets.keys',
        "import { smsSupportTickets } from './sms-fixtures'\n"
      )
    ).toEqual([])
  })

  it('flags the tables module reached by any route but a static import of a named descriptor', () => {
    expect(
      violations(
        'const rows = insert(smsSupportJobs, row)',
        "import { insert } from './table'\nimport { smsSupportJobs } from './tables.js'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = insert(smsSupportTickets, row)',
        "import { insert } from './table'\nimport { smsSupportTickets } from '@/db/tables.ts'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = insert(smsSupportJobs, row)',
        "import { insert } from './table'\nimport { smsSupportJobs } from './tables.mjs'\n"
      )
    ).toEqual(['descriptor'])
    expect(
      violations(
        'const rows = insert(smsSupportJobs, row)',
        "import { insert } from './table'\nimport { smsSupportJobs } from '../db/tables.cjs'\n"
      )
    ).toEqual(['descriptor'])
    expect(violations('const { smsSupportJobs } = t', "import * as t from './tables'\n")).toEqual([
      'module',
    ])
    expect(
      violations('const { smsSupportTickets } = tables', "import { tables } from './tables'\n")
    ).toEqual(['module'])
    expect(
      violations('const picked = tables[name]', "import { tables } from './tables'\n")
    ).toEqual(['module'])
    expect(violations('use(t)', "import * as t from './tables'\n")).toEqual(['module'])
    expect(violations("const t = require('./tables')", '')).toEqual(['module'])
    expect(violations("const t = await import('./tables')", '')).toEqual(['module'])
    expect(violations("export { smsSupportTickets } from './tables'", '')).toEqual(['module'])
    expect(violations("export * from './tables'", '')).toEqual(['module'])
    expect(
      violations('export { smsSupportTickets }', "import { smsSupportTickets } from './tables'\n")
    ).toEqual(['descriptor'])
    expect(violations("export * from './sms-fixtures'", '')).toEqual([])
  })

  it('flags a second defineTable of an owned table anywhere but src/db/tables.ts', () => {
    expectEach({
      "const t = defineTable<{ status: string }>('sms_support_tickets', { status: col('status', 'text') })":
        ['definition'],
      "const j = defineTable('sms_support_jobs', {})": ['definition'],
      "const t = defineTable('public.sms_support_tickets', {})": ['definition'],
      'const t = defineTable(`"SMS_SUPPORT_JOBS"`, {})': ['definition'],
      "const t = defineTable('sms_support_tickets_archive', {})": [],
      'const t = defineTable(name, {})': [],
    })
    expect(
      violations(
        "export const smsSupportTickets = defineTable('sms_support_tickets', {})\nexport const smsSupportJobs = defineTable('sms_support_jobs', {})",
        "import { defineTable } from './table'\n",
        'src/db/tables.ts'
      )
    ).toEqual([])
  })

  it('reads the table name with a spaced schema dot, ONLY, a star and a quoted alias', () => {
    expectEach({
      'db.affected(sql`UPDATE public . sms_support_tickets SET status = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE "public" . "sms_support_jobs" SET locked_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`INSERT INTO public . sms_support_jobs (id) SELECT id FROM sms_support_tickets WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`DELETE FROM ONLY public . sms_support_tickets WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets * SET status = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE ONLY sms_support_jobs * SET locked_at = now() WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets AS "t" SET status = ${s} WHERE "t".id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_jobs AS "j" SET attempts = 0 WHERE "j".id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets "t--" SET state = ${s} WHERE id = ${id}`)': [
        'lifecycle',
      ],
      'db.affected(sql`UPDATE sms_support_tickets AS "it\'s" SET closed_at = now() WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets "t" SET "last_outbound_at" = now() WHERE "t".id = ${id}`)':
        [],
      'db.affected(sql`UPDATE public . sms_messages SET status = ${s} WHERE id = ${id}`)': [],
    })
  })

  it('ends a ticket SET clause at a top-level WHERE, RETURNING, semicolon, the end, or a FROM that does not follow IS DISTINCT', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${a} IS DISTINCT FROM ${b}, status = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${a} IS NOT DISTINCT FROM ${b}, state = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${a} is  distinct\n  from ${b}, closed_at = now()`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets t SET admin_summary = m.body FROM sms_messages m WHERE m.status = ${s} AND t.id = ${id}`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = now() RETURNING status, state`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets SET retry_count = 0; SELECT status FROM sms_support_tickets`)':
        [],
    })
  })

  it('keeps a row-constructor target in the SET clause after SET or a comma', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${a}, (status, state) = (${s}, ${t}) WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET retry_count = 0,(automation_status) = ROW(${s}) WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${a}, (retry_count, last_outbound_at) = (${n}, now()) WHERE id = ${id}`)':
        [],
    })
  })

  it('flags TRUNCATE of either table', () => {
    expectEach({
      'db.affected(sql`TRUNCATE sms_support_jobs`)': ['lifecycle'],
      'db.affected(sql`truncate table only public.sms_support_tickets restart identity cascade`)': [
        'lifecycle',
      ],
      'db.affected(sql`TRUNCATE sms_messages, "sms_support_jobs"`)': ['lifecycle'],
      'db.affected(sql`TRUNCATE sms_messages; SELECT id FROM sms_support_jobs`)': [],
      'db.affected(sql`TRUNCATE sms_support_jobs_archive`)': [],
    })
  })

  it('leaves UI copy and other tables alone', () => {
    expectEach({
      "const copy = 'Update your ticket status'": [],
      "const copy = 'Update sms support tickets, then set the status filter'": [],
      "const copy = 'We will update the job status shortly'": [],
      'const copy = "Don\'t update the ticket\'s status"': [],
      'db.affected(sql`UPDATE sms_messages SET status = ${s} WHERE id = ${id}`)': [],
      'db.affected(sql`UPDATE sms_support_tickets_archive SET status = ${s}`)': [],
      'db.many(sql`SELECT status, state, closed_at FROM sms_support_tickets WHERE status = ${s}`)':
        [],
    })
  })
})

const BYPASS_IMPORTS = [
  "import { db } from './pool'",
  "import { identifier, join, raw, sql, type Sql } from './sql'",
  "import { col, defineTable, insert, set } from './table'",
  "import { smsSupportTicketDetails } from './tables'",
  '',
  '',
].join('\n')

const BYPASSES: Record<string, [string, string[]]> = {
  'B01-import-alias': [
    "import { smsSupportTickets as tickets } from './tables'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${set(tickets, { status: 'CLOSED' })} WHERE id = ${id}`)\n",
    ['descriptor', 'descriptor', 'interpolation'],
  ],
  'B02-namespace-destructure': [
    "import * as t from './tables'\nconst { smsSupportJobs } = t\nexport const f = (ticketId: string) => db.affected(insert(smsSupportJobs, { ticketId, kind: 'RUN_SUPPORT_AUTOMATION', status: 'QUEUED' }))\n",
    ['module'],
  ],
  'B03-tables-export-destructure': [
    "import { tables } from './tables'\nconst { smsSupportTickets } = tables\nexport const f = (id: string) => db.affected(sql`UPDATE ${identifier(smsSupportTickets.name)} SET ${set(smsSupportTickets, { status: 'CLOSED' })} WHERE id = ${id}`)\n",
    ['module'],
  ],
  'B04-interpolated-table-literal': [
    "export const f = (id: string) => db.affected(sql`UPDATE ${identifier('sms_support_tickets')} SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B05-interpolated-details-name': [
    "export const f = (id: string) => db.affected(sql`UPDATE ${identifier(smsSupportTicketDetails.name)} SET status = 'CLOSED', closed_at = now() WHERE id = ${id}`)\n",
    [],
  ],
  'B06-second-definetable-set': [
    "const ticketStatus = defineTable<{ status: string }>('sms_support_tickets', { status: col('status', 'text') })\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${set(ticketStatus, { status: 'CLOSED' })} WHERE id = ${id}`)\n",
    ['definition', 'interpolation'],
  ],
  'B07-second-definetable-insert': [
    "const jobs = defineTable<{ ticketId: string; kind: string; status: string }>('sms_support_jobs', { ticketId: col('ticket_id', 'text'), kind: col('kind', 'text'), status: col('status', 'text') })\nexport const f = (ticketId: string) => db.affected(insert(jobs, { ticketId, kind: 'RUN_SUPPORT_AUTOMATION', status: 'QUEUED' }))\n",
    ['definition'],
  ],
  'B08-update-only': [
    "export const f = (id: string) => db.affected(sql`UPDATE ONLY sms_support_tickets SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B09-merge-into': [
    "export const f = (id: string) => db.affected(sql`MERGE INTO sms_support_jobs j USING (SELECT ${id}::text AS id) s ON j.id = s.id WHEN MATCHED THEN UPDATE SET status = 'QUEUED'`)\n",
    ['merge'],
  ],
  'B10-delete-from': [
    'export const f = (ticketId: string) => db.affected(sql`DELETE FROM sms_support_jobs WHERE ticket_id = ${ticketId}`)\n',
    ['lifecycle'],
  ],
  'B11-helper-assignments': [
    "function updateTicket(id: string, assignments: Sql) { return db.affected(sql`UPDATE sms_support_tickets SET ${assignments} WHERE id = ${id}`) }\nexport const f = (id: string) => updateTicket(id, sql`status = 'CLOSED'`)\n",
    ['interpolation'],
  ],
  'B12-helper-generic-table': [
    "function updateRow(table: string, assignments: string, id: string) { return db.affected(sql`UPDATE ${raw(table)} SET ${raw(assignments)} WHERE id = ${id}`) }\nexport const f = (id: string) => updateRow('sms_support_tickets', \"status = 'CLOSED'\", id)\n",
    [],
  ],
  'B13-set-details-owned-key': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: 'x', status: 'CLOSED' } as never)} WHERE id = ${id}`)\n",
    [],
  ],
  'B14-set-details-raw-value': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: raw(\"'Closed', status = 'CLOSED', state = 'CLOSED'\") })} WHERE id = ${id}`)\n",
    ['raw'],
  ],
  'B15-raw-value-position': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = ${raw(\"'Closed', status = 'CLOSED'\")} WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B16-raw-concat-literals': [
    "export const f = () => db.affected(raw('UPDATE sms_support_tickets ' + \"SET status = 'CLOSED'\"))\n",
    ['lifecycle'],
  ],
  'B17-concat-variable-column': [
    "const column = 'status'\nexport const f = (id: string) => db.query('UPDATE sms_support_tickets SET ' + column + ' = $1 WHERE id = $2', ['CLOSED', id])\n",
    ['interpolation'],
  ],
  'B18-from-in-set-string': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'Moved from automation', status = 'NEEDS_CSR' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B19-subquery-in-set': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET retry_count = (SELECT count(*) FROM sms_support_jobs WHERE ticket_id = ${id}), status = 'OPEN' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B20-join-fragments': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${join([sql`status = 'CLOSED'`, sql`state = 'CLOSED'`], ', ')} WHERE id = ${id}`)\n",
    ['interpolation'],
  ],
  'B21-tables-js-extension': [
    "import { smsSupportJobs } from './tables.js'\nexport const f = (ticketId: string) => db.affected(insert(smsSupportJobs, { ticketId, kind: 'RUN_SUPPORT_AUTOMATION', status: 'QUEUED' }))\n",
    ['descriptor'],
  ],
  'B22-sql-line-comment': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets -- close it\nSET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'B23-array-join': [
    "export const f = (id: string) => db.query(['UPDATE sms_support_tickets', \"SET status = 'CLOSED'\", 'WHERE id = $1'].join(' '), [id])\n",
    [],
  ],
  'B24-cte-update': [
    "export const f = (id: string) => db.affected(sql`WITH moved AS (UPDATE sms_support_tickets SET status = 'CLOSED' WHERE id = ${id} RETURNING id) SELECT count(*) FROM moved`)\n",
    ['lifecycle'],
  ],
  'B25-returning-in-string': [
    "export const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'Customer returning soon', state = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
}

describe('verifier bypasses', () => {
  for (const [name, [source, expected]] of Object.entries(BYPASSES)) {
    it(name, () => {
      expect(violations(source, BYPASS_IMPORTS, `src/db/zz-${name}.ts`)).toEqual(expected)
    })
  }
})

const ROUND_1_BYPASSES: Record<string, [string, string[]]> = {
  'N01-quoted-alias': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets AS \"t\" SET status = 'CLOSED' WHERE \"t\".id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N02-quoted-alias-dashdash': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets \"t--\" SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N03-quoted-alias-apostrophe': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets AS \"t'\" SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N04-spaced-schema-dot-update': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE public . sms_support_tickets SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N05-spaced-schema-dot-insert-select': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`INSERT INTO public . sms_support_jobs (ticket_id, kind, status, payload) SELECT id, 'RUN_SUPPORT_AUTOMATION', 'QUEUED', '{}'::jsonb FROM sms_support_tickets WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N06-star-suffix': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets * SET status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N07-row-constructor-after-scalar': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'x', (status, state) = ('CLOSED', 'CLOSED') WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N08-local-set-shadow': [
    "import { db } from './pool'\nimport { raw, sql } from './sql'\nimport { smsSupportTicketDetails } from './tables'\nfunction set(_table: unknown, _patch: unknown) { return raw(\"status = 'CLOSED'\") }\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { adminSummary: 'x' })} WHERE id = ${id}`)\n",
    [],
  ],
  'N09-estring-escaped-quote': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = E'where\\\\'s', status = 'CLOSED' WHERE id = ${id}`)\n",
    [],
  ],
  'N10-unicode-escape-column': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET U&\"stat\\\\0075s\" = 'CLOSED' WHERE id = ${id}`)\n",
    [],
  ],
  'N11-unicode-escape-table': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE U&\"sms\\\\005Fsupport_tickets\" SET status = 'CLOSED' WHERE id = ${id}`)\n",
    [],
  ],
  'N12-is-distinct-from': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE sms_support_tickets SET admin_summary = 'x' IS DISTINCT FROM 'y', status = 'CLOSED' WHERE id = ${id}`)\n",
    ['lifecycle'],
  ],
  'N13-dynamic-import-variable': [
    "import { db } from './pool'\nimport { insert } from './table'\nconst tablesModule = './tables'\nexport const f = async (ticketId: string) => {\n  const { smsSupportJobs } = await import(tablesModule)\n  return db.affected(insert(smsSupportJobs, { ticketId, kind: 'RUN_SUPPORT_AUTOMATION', status: 'QUEUED', payload: {} } as never))\n}\n",
    [],
  ],
  'N14-do-block': [
    "import { db } from './pool'\nimport { raw, sql } from './sql'\nexport const f = (id: string) => db.affected(sql`DO $$ BEGIN UPDATE sms_support_tickets SET status = 'CLOSED' WHERE id = ${raw(`'${id}'`)}; END $$`)\n",
    [],
  ],
  'N15-view-multistatement': [
    "import { getPool } from './pool'\nexport const f = async (id: string) => { await getPool().query(`CREATE OR REPLACE VIEW zz_tickets AS SELECT * FROM sms_support_tickets; UPDATE zz_tickets SET status = 'CLOSED' WHERE id = '${id}'`) }\n",
    [],
  ],
  'N16-truncate': [
    "import { db } from './pool'\nimport { sql } from './sql'\nexport const f = (_id: string) => db.affected(sql`TRUNCATE sms_support_jobs`)\n",
    ['lifecycle'],
  ],
  'N17-identifier-concat': [
    "import { db } from './pool'\nimport { identifier, sql } from './sql'\nexport const f = (id: string) => db.affected(sql`UPDATE ${identifier('sms_' + 'support_tickets')} SET status = 'CLOSED' WHERE id = ${id}`)\n",
    [],
  ],
}

describe('verifier round 1 bypasses, as whole files', () => {
  for (const [name, [source, expected]] of Object.entries(ROUND_1_BYPASSES)) {
    it(name, () => {
      expect(violations(source, '', `src/db/zz-${name}.ts`)).toEqual(expected)
    })
  }
})
