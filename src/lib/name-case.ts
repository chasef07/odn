const NAME_SEPARATOR = /(\s+|[-'’‘])/

export function capitalizeName(value: string): string {
  return value
    .split(NAME_SEPARATOR)
    .map((part) =>
      NAME_SEPARATOR.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join('')
}
