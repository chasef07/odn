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

const LOCAL_GETTERS = new Set(['getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours'])

const DATE_STATICS = new Set(['UTC', 'parse'])

const LOCALE_FORMATTERS = new Set([
  'toLocaleDateString',
  'toLocaleTimeString',
  'toDateString',
  'toTimeString',
])

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

const ISO_SERIALIZERS = new Set(['toISOString', 'toJSON'])

const TIME_READERS = new Set(['getTime', 'valueOf'])

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

function isDateFns(source) {
  return source === 'date-fns' || source === 'date-fns-tz' || source.startsWith('date-fns/')
}

function parsesOneValue(node) {
  return isNewDate(node) && node.arguments.length === 1
}

function isIntlDateTimeFormat(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'Intl' &&
    propertyName(node) === 'DateTimeFormat'
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
      parts:
        "Don't build a Date from year, month and day numbers. Parse a yyyy-MM-dd day with parseDateOnly() from '@/lib/dates', and use addDays() or addMonthsUTC() for arithmetic.",
      static:
        "`Date.{{name}}()` hand-builds a moment. Use parseDateOnly() and utcDateFromDateOnly() for a calendar day, or instantOf() for a Date you already hold, from '@/lib/dates'.",
      getter:
        "`.{{name}}()` reads the runtime's zone. Use todayET(), todayInViewerZone(), dateOnlyFromUtcDate() or ageOn() from '@/lib/dates'.",
      setter:
        "`.{{name}}()` mutates a Date in the runtime's zone or by hand. Use addDays(), todayET(), todayUTC() or businessDayStart() from '@/lib/dates'.",
      locale:
        "`.{{name}}()` formats in the runtime's zone. Use formatDateOnly() or formatDateOnlyRange() for a calendar day and formatInstantET() for an instant, from '@/lib/dates'.",
      bareLocaleString:
        "`.toLocaleString()` with no locale formats in the runtime's zone and locale. Use formatDateOnly() or formatInstantET() from '@/lib/dates' for a date, or name the locale for a number, as in toLocaleString('en-US').",
      intlFormat:
        "Don't build an Intl.DateTimeFormat. Use formatDateOnly() or formatDateOnlyRange() for a calendar day, formatInstantET() for an instant, or todayInViewerZone() for the viewer's day, from '@/lib/dates'.",
      parse:
        "`{{form}}` parses a string the way Date.parse() does. Use parseInstant() for an ISO timestamp or parseDateOnly() for a yyyy-MM-dd day from '@/lib/dates', or call getTime() on the Date you already hold.",
      isoSlice:
        "`{{serializer}}().{{name}}()` is the UTC day, not the ET business day. Use todayET(), todayUTC() or dateOnlyFromUtcDate() from '@/lib/dates'.",
      dateFns:
        "Import date helpers from '@/lib/dates', not '{{source}}'. It owns the zone rules: DateOnly for calendar days, Instant for moments, ET for business time.",
    },
  },
  create(context) {
    function checkTimeSuffix(node, text) {
      if (TIME_SUFFIX.test(text)) context.report({ node, messageId: 'timeSuffix' })
    }

    function checkSource(node) {
      const source = node.source?.type === 'Literal' ? node.source.value : null
      if (typeof source === 'string' && isDateFns(source)) {
        context.report({ node, messageId: 'dateFns', data: { source } })
      }
    }

    return {
      ImportDeclaration: checkSource,
      ImportExpression: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      UnaryExpression(node) {
        if (node.operator === '+' && parsesOneValue(node.argument)) {
          context.report({ node, messageId: 'parse', data: { form: '+new Date(value)' } })
        }
      },
      NewExpression(node) {
        if (isIntlDateTimeFormat(node.callee)) {
          context.report({ node, messageId: 'intlFormat' })
          return
        }
        if (!isNewDate(node)) return
        if (node.arguments.length >= 2) {
          context.report({ node, messageId: 'parts' })
          return
        }
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
        if (isIntlDateTimeFormat(callee)) {
          context.report({ node, messageId: 'intlFormat' })
          return
        }
        if (callee.type !== 'MemberExpression') {
          if (
            callee.type === 'Identifier' &&
            callee.name === 'Number' &&
            node.arguments.length === 1 &&
            parsesOneValue(node.arguments[0])
          ) {
            context.report({ node, messageId: 'parse', data: { form: 'Number(new Date(value))' } })
          }
          return
        }
        const name = propertyName(callee)
        if (!name) return
        if (callee.object.type === 'Identifier' && callee.object.name === 'Date') {
          if (DATE_STATICS.has(name)) context.report({ node, messageId: 'static', data: { name } })
          return
        }
        if (LOCAL_GETTERS.has(name)) {
          context.report({ node, messageId: 'getter', data: { name } })
          return
        }
        if (DATE_SETTERS.has(name)) {
          context.report({ node, messageId: 'setter', data: { name } })
          return
        }
        if (TIME_READERS.has(name) && parsesOneValue(callee.object)) {
          context.report({ node, messageId: 'parse', data: { form: `new Date(value).${name}()` } })
          return
        }
        if (name === 'toLocaleString' && node.arguments.length === 0) {
          context.report({ node, messageId: 'bareLocaleString' })
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
          ISO_SERIALIZERS.has(propertyName(callee.object.callee))
        ) {
          const serializer = propertyName(callee.object.callee)
          context.report({ node, messageId: 'isoSlice', data: { serializer, name } })
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
