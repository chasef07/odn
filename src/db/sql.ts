export type Param = string | number | boolean | Date | null

type Piece = Param | Sql<unknown>

type Rows<V extends readonly unknown[]> = UnionToIntersection<
  {
    [I in keyof V]: V[I] extends Sql<infer R> ? ([unknown] extends [R] ? never : R) : never
  }[number]
>

type RowOf<V extends readonly unknown[]> = [Rows<V>] extends [never] ? unknown : Rows<V>

type UnionToIntersection<U> = [U] extends [never]
  ? never
  : (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
    ? I
    : never

export class Sql<R = unknown> {
  declare readonly row?: R
  readonly strings: readonly string[]
  readonly values: readonly unknown[]

  constructor(strings: readonly string[], values: readonly unknown[]) {
    this.strings = strings
    this.values = values
  }

  compile(): { text: string; values: unknown[] } {
    const text = this.strings.reduce((out, part, index) => `${out}$${index}${part}`)
    return { text, values: [...this.values] }
  }
}

export function sql<const V extends readonly Piece[]>(
  template: TemplateStringsArray,
  ...pieces: V
): Sql<RowOf<V>> {
  const raw = template.raw
  const strings: string[] = [raw[0]]
  const values: unknown[] = []
  pieces.forEach((piece, index) => {
    if (piece instanceof Sql) {
      strings[strings.length - 1] += piece.strings[0]
      for (let part = 1; part < piece.strings.length; part++) {
        values.push(piece.values[part - 1])
        strings.push(piece.strings[part])
      }
      strings[strings.length - 1] += raw[index + 1]
    } else {
      values.push(piece)
      strings.push(raw[index + 1])
    }
  })
  return new Sql(strings, values)
}

export function raw(text: string): Sql {
  return new Sql([text], [])
}

export type Direction = 'ASC' | 'DESC'

export function direction(value: Direction): Sql {
  if (value !== 'ASC' && value !== 'DESC') throw new Error(`${value} is not a sort direction`)
  return raw(value)
}

export function quote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

export function identifier(name: string): Sql {
  return raw(quote(name))
}

export function subquery(query: Sql<unknown>): Sql {
  return sql`(${query})` as Sql
}

export function json(value: unknown): Sql {
  if (value === null || value === undefined) return raw('NULL')
  return new Sql(['', '::jsonb'], [JSON.stringify(value)])
}

const TYPE_NAME = /^"?[A-Za-z_]\w*"?$/

export function array(values: readonly (string | number)[], type?: string): Sql {
  if (type !== undefined && !TYPE_NAME.test(type)) throw new Error(`${type} is not a type name`)
  return new Sql(['', type ? `::${type}[]` : ''], [[...values]])
}

export function join(fragments: readonly Sql<unknown>[], separator: string): Sql {
  return fragments.reduce<Sql>(
    (out, fragment, index) =>
      index === 0 ? sql`${fragment}` : sql`${out}${raw(separator)}${fragment}`,
    raw('')
  )
}

export function and(...fragments: (Sql<unknown> | false | null | undefined)[]): Sql {
  const present = fragments.filter((fragment): fragment is Sql<unknown> => fragment instanceof Sql)
  if (present.length === 0) return raw('TRUE')
  return sql`(${join(present, ' AND ')})`
}

export function or(...fragments: (Sql<unknown> | false | null | undefined)[]): Sql {
  const present = fragments.filter((fragment): fragment is Sql<unknown> => fragment instanceof Sql)
  if (present.length === 0) return raw('FALSE')
  return sql`(${join(present, ' OR ')})`
}

export function count<A extends string>(alias: A): Sql<{ [K in A]: number }> {
  return new Sql([`count(*)::int AS ${quote(alias)}`], [])
}

export function expression<T>() {
  return <A extends string>(alias: A, fragment: Sql<unknown>): Sql<{ [K in A]: T }> =>
    sql`(${fragment}) AS ${identifier(alias)}` as Sql<{ [K in A]: T }>
}

export function likeContains(term: string): string {
  return `%${escapeLike(term)}%`
}

export function likeStartsWith(term: string): string {
  return `${escapeLike(term)}%`
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`)
}
