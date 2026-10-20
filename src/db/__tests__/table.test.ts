import { describe, expect, it } from 'vitest'
import { sql } from '../sql'
import { col, defineTable, insert, select, selectAll, set } from '../table'
import { noteVerifications, submissionBirth, submissions, telnyxWebhookEvents } from '../tables'

const UUID = /^[0-9a-f-]{36}$/

describe('select', () => {
  it('aliases picked columns to their domain names', () => {
    expect(select(submissions, ['id', 'patientFirstName']).compile().text).toBe(
      '"submissions"."id" AS "id", "submissions"."patient_first_name" AS "patientFirstName"'
    )
  })

  it('prefixes joined columns from an aliased table', () => {
    expect(
      select(submissions, ['status', 'refundedAt'], { alias: 's', prefix: 'submission' }).compile()
        .text
    ).toBe('"s"."status" AS "submissionStatus", "s"."refunded_at" AS "submissionRefundedAt"')
  })

  it('selects every column of a table', () => {
    const { text } = selectAll(telnyxWebhookEvents).compile()
    expect(text.split(', ')).toHaveLength(6)
    expect(text).toContain('"telnyx_webhook_events"."last_error" AS "lastError"')
  })
})

describe('defineTable', () => {
  it('refuses a column kind that does not fit the domain type', () => {
    type Row = { total: number; at: Date }
    defineTable<Row>('rows', {
      // @ts-expect-error a number column is 'int', not 'text'
      total: col('total', 'text'),
      at: col('at', 'timestamp'),
    })
    defineTable<Row>('rows', {
      total: col('total', 'int'),
      // @ts-expect-error a Date column is 'timestamp' or 'date', not 'int'
      at: col('at', 'int'),
    })
  })
})

describe('insert', () => {
  it('refuses a refund column through the birth descriptor', () => {
    expect(() =>
      insert(submissionBirth, {
        stripePaymentIntentId: 'pi_1',
        status: 'DENIED',
        // @ts-expect-error a row is born without a refund
        stripeRefundId: 're_1',
        refundedAt: new Date(),
      })
    ).toThrow('insert(submissions) cannot write stripeRefundId, refundedAt')
  })

  it('refuses a key outside the descriptor that a spread carried in', () => {
    const row = { stripePaymentIntentId: 'pi_1', state: 'CA', notes: 'not a column' }
    const values: { stripePaymentIntentId: string; state: string } = row

    expect(() => insert(submissionBirth, values)).toThrow('insert(submissions) cannot write notes')
  })

  it('fills id, created_at and updated_at when the table has them and the caller did not', () => {
    const { text, values } = insert(noteVerifications, {
      submissionId: 'sub_1',
      medicalRecordNumber: 'MRN1',
    }).compile()

    expect(text).toBe(
      'INSERT INTO "note_verifications" ("id", "submission_id", "medical_record_number", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5)'
    )
    expect(values[0]).toMatch(UUID)
    expect(values.slice(1, 3)).toEqual(['sub_1', 'MRN1'])
    expect(values[3]).toBeInstanceOf(Date)
    expect(values[3]).toBe(values[4])
  })

  it('keeps a caller-provided id and timestamps, and stringifies JSON columns', () => {
    const occurredAt = new Date('2026-01-01T00:00:00.000Z')
    const event = insert(telnyxWebhookEvents, {
      id: 'evt_1',
      eventType: 'message.received',
      occurredAt,
      status: 'PROCESSED',
      lastError: null,
    }).compile()
    expect(event.values).toEqual(['evt_1', 'message.received', occurredAt, 'PROCESSED', null])

    const withJson = insert(submissions, {
      id: 'sub_1',
      symptoms: ['Fever'],
      attribution: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    }).compile()
    expect(withJson.text).toContain('$1, NULL, $2::jsonb, $3, $4')
    expect(withJson.values).toEqual(['sub_1', '["Fever"]', occurredAt, occurredAt])
  })
})

describe('set', () => {
  it('refuses a key outside the descriptor, even one set to undefined', () => {
    const patch = { status: 'APPROVED' as const, reviewNote: undefined }

    expect(() => set(submissions, { ...patch })).toThrow('set(submissions) cannot write reviewNote')
  })

  it('appends updated_at unless the caller sets it, and accepts SQL expressions', () => {
    const stamped = set(submissions, { status: 'APPROVED' }).compile()
    expect(stamped.text).toBe('"status" = $1, "updated_at" = $2')
    expect(stamped.values[1]).toBeInstanceOf(Date)

    const explicit = new Date('2026-02-02T00:00:00.000Z')
    expect(set(submissions, { status: 'APPROVED', updatedAt: explicit }).compile()).toEqual({
      text: '"status" = $1, "updated_at" = $2',
      values: ['APPROVED', explicit],
    })

    const expression = set(telnyxWebhookEvents, { lastError: null, processedAt: sql`now()` })
    expect(expression.compile()).toEqual({
      text: '"last_error" = $1, "processed_at" = now()',
      values: [null],
    })
  })
})
