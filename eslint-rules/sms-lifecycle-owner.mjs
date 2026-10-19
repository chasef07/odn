const HOLE = '\u0000'
const EVERY_COLUMN = '*'
const INSERT_TARGET = /\bINSERT\s+INTO\s+(?:"?public"?\.)?"?(\w+)"?/i
const DO_UPDATE_SET = /\bDO\s+UPDATE\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING)\s|;|$)/gi
const TABLES_MODULE = /(^|\/)tables$/
const DESCRIPTOR_CONSUMERS = new Set(['select', 'selectAll', 'deleteEveryRow'])

function columnMatcher(columns) {
  if (columns === EVERY_COLUMN) return () => true
  const pattern = new RegExp(String.raw`\b(?:${columns.join('|')})\b`, 'i')
  return (text) => pattern.test(text)
}

function compileTable(table) {
  const name = String.raw`(?:"?public"?\.)?"?${table.name}"?`
  return {
    name: table.name,
    details: table.details,
    updateSet: new RegExp(
      String.raw`\bUPDATE\s+${name}(?:\s+(?:AS\s+)?(?!SET\b)[A-Za-z_]\w*)?\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING|FROM)\s|;|$)`,
      'gi'
    ),
    insertInto: new RegExp(String.raw`\bINSERT\s+INTO\s+${name}[\s(]([\s\S]*)`, 'i'),
    writesOwnedColumn: columnMatcher(table.columns),
    insertsOwnedColumn: columnMatcher(table.insertColumns),
    ownsUnknownConflictTarget: table.columns !== EVERY_COLUMN,
  }
}

function templateText(node) {
  return node.quasis
    .map((quasi, index) => `${quasi.value.cooked ?? ''}${HOLE}${index}${HOLE}`)
    .join('')
}

function isConcatenation(node) {
  return node.type === 'BinaryExpression' && node.operator === '+'
}

function concatenatedText(node) {
  if (isConcatenation(node)) return `${concatenatedText(node.left)}${concatenatedText(node.right)}`
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : ' '
}

function setClauses(text, table) {
  return [...text.matchAll(table.updateSet)].map((match) => match[1])
}

function writesLifecycle(text, tables) {
  const target = INSERT_TARGET.exec(text)?.[1].toLowerCase()
  const conflictClauses = [...text.matchAll(DO_UPDATE_SET)].map((match) => match[1])
  return tables.some((table) => {
    if (setClauses(text, table).some(table.writesOwnedColumn)) return true
    const insert = table.insertInto.exec(text)
    if (insert && table.insertsOwnedColumn(insert[1])) return true
    const targeted =
      target === table.name || (target === undefined && table.ownsUnknownConflictTarget)
    return targeted && conflictClauses.some(table.writesOwnedColumn)
  })
}

function isDetailsSet(expression, details) {
  return (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'set' &&
    expression.arguments[0]?.type === 'Identifier' &&
    expression.arguments[0].name === details
  )
}

function columnHoles(clause) {
  const holes = []
  let depth = 0
  let columnNext = true
  for (const token of clause.matchAll(/\u0000(\d+)\u0000|\S/g)) {
    if (token[1] !== undefined) {
      if (depth === 0 && columnNext) holes.push(Number(token[1]))
      columnNext = false
      continue
    }
    if (token[0] === '(') depth += 1
    if (token[0] === ')') depth -= 1
    columnNext = depth === 0 && token[0] === ','
  }
  return holes
}

function foreignSetInterpolations(node, tables) {
  const text = templateText(node)
  return tables
    .filter((table) => table.details !== undefined)
    .flatMap((table) =>
      setClauses(text, table).flatMap((clause) =>
        columnHoles(clause)
          .map((index) => node.expressions[index])
          .filter((expression) => !isDetailsSet(expression, table.details))
      )
    )
}

function memberName(node) {
  if (node.type !== 'MemberExpression') return null
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal') return String(node.property.value)
  return null
}

function isReadHelperArgument(identifier) {
  const call = identifier.parent
  return (
    call.type === 'CallExpression' &&
    call.callee.type === 'Identifier' &&
    DESCRIPTOR_CONSUMERS.has(call.callee.name) &&
    call.arguments[0] === identifier
  )
}

function lifecycleOwner(config) {
  const tables = config.tables.map(compileTable)
  const descriptors = new Set(config.tables.map((table) => table.descriptor))
  return {
    meta: {
      type: 'problem',
      docs: { description: config.description },
      schema: [],
      messages: config.messages,
    },
    create(context) {
      function checkText(node, text) {
        if (writesLifecycle(text, tables)) context.report({ node, messageId: 'lifecycle' })
      }
      function checkImport(node) {
        if (!TABLES_MODULE.test(String(node.source.value))) return
        for (const specifier of node.specifiers) {
          const [variable] = context.sourceCode.getDeclaredVariables(specifier)
          const imported = specifier.type === 'ImportSpecifier' ? specifier.imported.name : null
          if (specifier.type === 'ImportNamespaceSpecifier' || imported === 'tables') {
            for (const reference of variable.references) {
              const member = reference.identifier.parent
              if (member.object === reference.identifier && descriptors.has(memberName(member))) {
                context.report({ node: member, messageId: 'descriptor' })
              }
            }
          }
          if (!descriptors.has(imported)) continue
          if (specifier.local.name !== imported) {
            context.report({ node: specifier, messageId: 'descriptor' })
          }
          for (const reference of variable.references) {
            if (!isReadHelperArgument(reference.identifier)) {
              context.report({ node: reference.identifier, messageId: 'descriptor' })
            }
          }
        }
      }
      return {
        ImportDeclaration: checkImport,
        Literal(node) {
          if (typeof node.value !== 'string' || isConcatenation(node.parent)) return
          checkText(node, node.value)
        },
        BinaryExpression(node) {
          if (!isConcatenation(node) || isConcatenation(node.parent)) return
          checkText(node, concatenatedText(node))
        },
        TemplateLiteral(node) {
          checkText(node, templateText(node))
          for (const expression of foreignSetInterpolations(node, tables)) {
            context.report({ node: expression, messageId: 'interpolation' })
          }
        },
      }
    },
  }
}

const smsLifecycleOwner = lifecycleOwner({
  description:
    'Only src/db/sms-support-lifecycle.ts inserts SMS support tickets, writes their status columns, and writes support jobs',
  tables: [
    {
      name: 'sms_support_tickets',
      descriptor: 'smsSupportTickets',
      details: 'smsSupportTicketDetails',
      columns: ['status', 'state', 'automation_status', 'closed_at'],
      insertColumns: EVERY_COLUMN,
    },
    {
      name: 'sms_support_jobs',
      descriptor: 'smsSupportJobs',
      columns: EVERY_COLUMN,
      insertColumns: EVERY_COLUMN,
    },
  ],
  messages: {
    lifecycle:
      'Only src/db/sms-support-lifecycle.ts inserts SMS support tickets, writes their status, state, automation_status and closed_at, and writes sms_support_jobs. Write other ticket columns with set(smsSupportTicketDetails, ...) and move tickets and jobs through the lifecycle.',
    interpolation:
      'Inside the SET clause of an UPDATE of sms_support_tickets, interpolate only set(smsSupportTicketDetails, ...). Name every other column in the SQL text, and change status, state, automation_status or closed_at through src/db/sms-support-lifecycle.ts.',
    descriptor:
      'Outside src/db/sms-support-lifecycle.ts the smsSupportTickets and smsSupportJobs descriptors are only read or wiped. Pass each under its own name, only as the first argument of select, selectAll or deleteEveryRow. Write other ticket columns with set(smsSupportTicketDetails, ...) and change status or jobs through the lifecycle.',
  },
})

const plugin = { rules: { 'sms-lifecycle-owner': smsLifecycleOwner } }

export default plugin
