import { randomUUID } from 'node:crypto'
import type { JsonValue } from './types'
import { identifier, join, json, quote, raw, Sql, sql } from './sql'

export type Column<Nullable extends boolean = boolean, Json extends boolean = boolean> = {
  readonly name: string
  readonly nullable: Nullable
  readonly json: Json
  readonly generated: boolean
}

type ColumnFor<T> = [JsonValue] extends [T]
  ? Column<boolean, true>
  : null extends T
    ? Column<true, false>
    : Column<false, false>

export type Columns<D> = { readonly [K in keyof D]-?: ColumnFor<D[K]> }

export type Table<D> = {
  readonly name: string
  readonly columns: Columns<D>
  readonly keys: readonly (keyof D & string)[]
}

export function col(name: string): Column<false, false> {
  return { name, nullable: false, json: false, generated: false }
}

export function uuid(name: string): Column<false, false> {
  return { name, nullable: false, json: false, generated: true }
}

export function nullable(name: string): Column<true, false> {
  return { name, nullable: true, json: false, generated: false }
}

export function jsonCol(name: string): Column<false, true> {
  return { name, nullable: false, json: true, generated: false }
}

export function nullableJson(name: string): Column<true, true> {
  return { name, nullable: true, json: true, generated: false }
}

export function defineTable<D>(name: string, columns: Columns<D>): Table<D> {
  return { name, columns, keys: Object.keys(columns) as (keyof D & string)[] }
}

type Prefixed<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<K & string>}`]: T[K]
}

type Selected<D, K extends keyof D, P extends string> = P extends ''
  ? Pick<D, K>
  : Prefixed<Pick<D, K>, P>

export function select<D, K extends keyof D & string, P extends string = ''>(
  table: Table<D>,
  keys: readonly K[],
  options: { alias?: string; prefix?: P } = {}
): Sql<Selected<D, K, P>> {
  const source = quote(options.alias ?? table.name)
  const list = keys.map((key) => {
    const column = table.columns[key] as Column
    const outputName = options.prefix ? `${options.prefix}${capitalize(key)}` : key
    return `${source}.${quote(column.name)} AS ${quote(outputName)}`
  })
  return new Sql([list.join(', ')], [])
}

export function selectAll<D>(table: Table<D>, options?: { alias?: string }): Sql<D> {
  return select(table, table.keys, options) as Sql<D>
}

export type Patch<D> = { [K in keyof D]?: D[K] | Sql<unknown> }

export function insert<D>(table: Table<D>, values: Patch<D>): Sql {
  const row = stamped(table, values, true)
  const keys = table.keys.filter((key) => row[key] !== undefined)
  const columns = keys.map((key) => quote((table.columns[key] as Column).name))
  const placeholders = keys.map((key) => value(table, key, row[key]))
  return sql`INSERT INTO ${identifier(table.name)} (${raw(columns.join(', '))}) VALUES (${join(placeholders, ', ')})`
}

export function set<D>(table: Table<D>, patch: Patch<D>): Sql {
  const row = stamped(table, patch, false)
  const assignments = table.keys
    .filter((key) => row[key] !== undefined)
    .map(
      (key) =>
        sql`${identifier((table.columns[key] as Column).name)} = ${value(table, key, row[key])}`
    )
  if (assignments.length === 0) throw new Error(`set(${table.name}) has nothing to assign`)
  return join(assignments, ', ')
}

function stamped<D>(table: Table<D>, values: Patch<D>, inserting: boolean): Patch<D> {
  const row: Record<string, unknown> = { ...values }
  const now = new Date()
  const id = (table.columns as Record<string, Column | undefined>).id
  if (inserting && id?.generated && row.id === undefined) row.id = randomUUID()
  if (inserting && 'createdAt' in table.columns && row.createdAt === undefined) row.createdAt = now
  if ('updatedAt' in table.columns && row.updatedAt === undefined) row.updatedAt = now
  return row as Patch<D>
}

function value<D>(table: Table<D>, key: keyof D & string, given: unknown): Sql<unknown> {
  if (given instanceof Sql) return given
  if ((table.columns[key] as Column).json) return json(given)
  return new Sql(['', ''], [given])
}

function capitalize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}
