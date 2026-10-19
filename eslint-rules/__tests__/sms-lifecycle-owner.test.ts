import { Linter, type ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import smsLifecycleOwner from '../sms-lifecycle-owner.mjs'

const linter = new Linter()
const config: Linter.Config = {
  plugins: { local: smsLifecycleOwner as ESLint.Plugin },
  rules: { 'local/sms-lifecycle-owner': 'error' },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
}

const IMPORTS = [
  "import { db } from './pool'",
  "import { identifier, raw, sql } from './sql'",
  "import { deleteEveryRow, insert, select, selectAll, set } from './table'",
  "import { smsPhoneStates, smsSupportJobs, smsSupportTicketDetails, smsSupportTickets } from './tables'",
  '',
].join('\n')

function violations(code: string, imports = IMPORTS): string[] {
  return linter
    .verify(`${imports}${code}`, config)
    .map((message) => message.messageId ?? '')
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
      'db.affected(sql`\n    UPDATE sms_support_tickets\n    SET last_outbound_at = now(),\n      status = ${s}\n    WHERE id = ${id}`)':
        ['lifecycle'],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = now() WHERE id = ${id}; UPDATE sms_support_tickets SET state = ${s} WHERE id = ${id}`)':
        ['lifecycle'],
      "const q = 'UPDATE sms_support_tickets SET status = $1 WHERE id = $2'": ['lifecycle'],
      "const q = 'UPDATE sms_support_tickets SET ' + 'automation_status = $1 WHERE id = $2'": [
        'lifecycle',
      ],
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
      "const q = 'INSERT INTO sms_support_jobs (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET locked_at = $2'":
        ['lifecycle'],
      'db.affected(sql`${raw("x")} ON CONFLICT (id) DO UPDATE SET locked_at = now()`)': [],
      'db.many(sql`SELECT id FROM sms_support_jobs WHERE status = ${s}`)': [],
      'db.affected(sql`UPDATE sms_support_jobs_archive SET status = ${s}`)': [],
    })
  })

  it('flags an interpolated column in a ticket SET clause unless it is set(smsSupportTicketDetails, ...)', () => {
    expectEach({
      'db.affected(sql`UPDATE sms_support_tickets SET ${raw("status")} = ${s} WHERE id = ${id}`)': [
        'interpolation',
      ],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = now(), ${identifier(column)} = ${value} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE sms_support_tickets SET failure_reason = COALESCE(${a}, ${b}), ${raw(c)} = ${v} WHERE id = ${id}`)':
        ['interpolation'],
      'db.affected(sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { failureReason: null })} WHERE id = ${id} AND status = ${s}`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets t SET ${set(smsSupportTicketDetails, patch)}, last_outbound_at = now() WHERE t.id = ${id}`)':
        [],
      'db.affected(sql`UPDATE sms_support_tickets SET last_outbound_at = ${at} WHERE id = ${id} AND status = ${s} RETURNING status`)':
        [],
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

  it('leaves UI copy and other tables alone', () => {
    expectEach({
      "const copy = 'Update your ticket status'": [],
      "const copy = 'Update sms support tickets, then set the status filter'": [],
      "const copy = 'We will update the job status shortly'": [],
      'db.affected(sql`UPDATE sms_messages SET status = ${s} WHERE id = ${id}`)': [],
      'db.affected(sql`UPDATE sms_support_tickets_archive SET status = ${s}`)': [],
      'db.many(sql`SELECT status, state, closed_at FROM sms_support_tickets WHERE status = ${s}`)':
        [],
    })
  })
})
