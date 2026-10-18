const DATE_SETTERS = new Set([
  'setFullYear',
  'setMonth',
  'setDate',
  'setHours',
  'setMinutes',
  'setSeconds',
  'setMilliseconds',
  'setUTCFullYear',
  'setUTCMonth',
  'setUTCDate',
  'setUTCHours',
  'setUTCMinutes',
  'setUTCSeconds',
  'setUTCMilliseconds',
])

const LOCALE_FORMATTERS = new Set(['toLocaleDateString', 'toLocaleTimeString'])

const DATE_OPTION_KEYS = new Set([
  'year',
  'month',
  'day',
  'weekday',
  'hour',
  'minute',
  'second',
  'timeZone',
  'dateStyle',
  'timeStyle',
])

const ISO_SLICERS = new Set(['slice', 'split', 'substring'])

const TIME_SUFFIX = /^T\d{2}:\d{2}/

function propertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name
  if (member.computed && member.property.type === 'Literal') return String(member.property.value)
  return null
}

function isNewDate(node) {
  return (
    node.type === 'NewExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'Date'
  )
}

function buildsString(node) {
  if (node.type === 'Literal') return typeof node.value === 'string'
  if (node.type === 'TemplateLiteral') return true
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return buildsString(node.left) || buildsString(node.right)
  }
  return false
}

function hasDateOptions(node) {
  return (
    node?.type === 'ObjectExpression' &&
    node.properties.some(
      (property) =>
        property.type === 'Property' &&
        property.key.type === 'Identifier' &&
        DATE_OPTION_KEYS.has(property.key.name)
    )
  )
}

const noAdhocDates = {
  meta: {
    type: 'problem',
    docs: { description: 'Parse, format and count dates only through src/lib/dates.ts' },
    schema: [],
    messages: {
      builtString:
        "Don't build a Date from a hand-made string. Parse a yyyy-MM-dd day with parseDateOnly() and convert it with utcDateFromDateOnly() from '@/lib/dates'.",
      timeSuffix:
        "Don't append a time of day to a date string. A calendar day is a DateOnly from '@/lib/dates'; use utcDateFromDateOnly() for a database date, or businessDayStart() for the 6am ET reset.",
      setter:
        "`.{{name}}()` mutates a Date in the runtime's zone or by hand. Use addDays(), todayET(), todayUTC() or businessDayStart() from '@/lib/dates'.",
      locale:
        "`.{{name}}()` formats in the runtime's zone. Use formatDateOnly() or formatDateOnlyRange() for a calendar day and formatInstantET() for an instant, from '@/lib/dates'.",
      isoSlice:
        "`toISOString().{{name}}()` is the UTC day, not the ET business day. Use todayET(), todayUTC() or dateOnlyFromUtcDate() from '@/lib/dates'.",
      dateFns:
        "Import date helpers from '@/lib/dates', not '{{source}}'. It owns the zone rules: DateOnly for calendar days, Instant for moments, ET for business time.",
    },
  },
  create(context) {
    function checkTimeSuffix(node, text) {
      if (TIME_SUFFIX.test(text)) context.report({ node, messageId: 'timeSuffix' })
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (source === 'date-fns' || source === 'date-fns-tz' || source.startsWith('date-fns/')) {
          context.report({ node, messageId: 'dateFns', data: { source } })
        }
      },
      NewExpression(node) {
        if (!isNewDate(node)) return
        const argument = node.arguments[0]
        if (!argument) return
        if (
          (argument.type === 'TemplateLiteral' && argument.expressions.length > 0) ||
          (argument.type === 'BinaryExpression' && buildsString(argument))
        ) {
          context.report({ node, messageId: 'builtString' })
        }
      },
      Literal(node) {
        if (typeof node.value === 'string') checkTimeSuffix(node, node.value)
      },
      TemplateElement(node) {
        if (node.parent.quasis[0] !== node) checkTimeSuffix(node, node.value.cooked ?? '')
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        const name = propertyName(callee)
        if (!name) return
        if (DATE_SETTERS.has(name)) {
          context.report({ node, messageId: 'setter', data: { name } })
          return
        }
        if (
          LOCALE_FORMATTERS.has(name) ||
          (name === 'toLocaleString' &&
            (isNewDate(callee.object) || hasDateOptions(node.arguments[1])))
        ) {
          context.report({ node, messageId: 'locale', data: { name } })
          return
        }
        if (
          ISO_SLICERS.has(name) &&
          callee.object.type === 'CallExpression' &&
          callee.object.callee.type === 'MemberExpression' &&
          propertyName(callee.object.callee) === 'toISOString'
        ) {
          context.report({ node, messageId: 'isoSlice', data: { name } })
        }
      },
    }
  },
}

const plugin = {
  rules: {
    'no-adhoc-dates': noAdhocDates,
  },
}

export default plugin
