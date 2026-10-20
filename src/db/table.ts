import { randomUUID } from 'node:crypto'
import type { JsonValue } from './types'
import { identifier, join, json, quote, raw, Sql, sql } from './sql'

export type Kind = 'text' | 'int' | 'bool' | 'timestamp' | 'date' | 'jsonb' | 'enum'

type ScalarKind = Exclude<Kind, 'jsonb'>

export type Column<Nullable extends boolean = boolean, K extends Kind = Kind> = {
  readonly name: string
  readonly nullable: Nullable
  readonly kind: K
  readonly generated: boolean
}

type KindFor<T> = [T] extends [string]
  ? 'text' | 'enum'
  : [T] extends [number]
    ? 'int'
    : [T] extends [boolean]
      ? 'bool'
      : [T] extends [Date]
        ? 'timestamp' | 'date'
        : never

type ColumnFor<T> = [JsonValue] extends [T]
  ? Column<boolean, 'jsonb'>
  : null extends T
    ? Column<true, KindFor<NonNullable<T>>>
    : Column<false, KindFor<T>>

export type Columns<D> = { readonly [K in keyof D]-?: ColumnFor<D[K]> }

export type Table<D> = {
  readonly name: string
  readonly columns: Columns<D>
  readonly keys: readonly (keyof D & string)[]
}

export function col<K extends ScalarKind>(name: string, kind: K): Column<false, K> {
  return { name, nullable: false, kind, generated: false }
}

export function uuid(name: string): Column<false, 'text'> {
  return { name, nullable: false, kind: 'text', generated: true }
}

export function nullable<K extends ScalarKind>(name: string, kind: K): Column<true, K> {
  return { name, nullable: true, kind, generated: false }
}

export function jsonCol(name: string): Column<false, 'jsonb'> {
  return { name, nullable: false, kind: 'jsonb', generated: false }
}

export function nullableJson(name: string): Column<true, 'jsonb'> {
  return { name, nullable: true, kind: 'jsonb', generated: false }
}

export function defineTable<D>(name: string, columns: Columns<D>): Table<D> {
  return { name, columns, keys: Object.keys(columns) as (keyof D & string)[] }
}

export function without<T extends object, K extends keyof T>(
  object: T,
  keys: readonly K[]
): Omit<T, K> {
  const rest = { ...object }
  for (const key of keys) delete rest[key]
  return rest
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

export function selectAll<D>(table: Table<D>, options?: { alias?: string }): Sql<D>
export function selectAll<D, P extends string>(
  table: Table<D>,
  options: { alias?: string; prefix: P }
): Sql<Prefixed<D, P>>
export function selectAll<D>(
  table: Table<D>,
  options: { alias?: string; prefix?: string } = {}
): Sql<unknown> {
  return select(table, table.keys, options)
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
  const unknown = Object.keys(values).filter((key) => !Object.hasOwn(table.columns, key))
  if (unknown.length > 0) {
    const operation = inserting ? 'insert' : 'set'
    throw new Error(`${operation}(${table.name}) cannot write ${unknown.join(', ')}`)
  }
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
  if ((table.columns[key] as Column).kind === 'jsonb') return json(given)
  return new Sql(['', ''], [given])
}

function capitalize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}
