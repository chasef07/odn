const HOLE = '\u0000'
const HOLE_INDEX = /\u0000(\d+)\u0000/g
const EVERY_COLUMN = '*'
const SQL_TOKEN = new RegExp(
  String.raw`\u0000\d+\u0000|--[^\n]*|/\*[\s\S]*?(?:\*/|$)|'(?:[^']|'')*(?:'|$)|"(?:[^"\u0000]|"")*(?:"|$)|\$([A-Za-z_]\w*)?\$[\s\S]*?(?:\$\1\$|$)|[()]|[^\u0000'"$()/-]+|[\s\S]`,
  'g'
)
const QUOTED = /^(?:'|\$\w*\$)/
const COMMENT = /^(?:--|\/\*)/
const ROW_CONSTRUCTOR = /(?:\bSET|,)\s*$/i
const INSERT_TARGET = /\bINSERT\s+INTO\s+(?:"?public"?\s*\.\s*)?"?(\w+)"?/i
const DO_UPDATE_SET = /\bDO\s+UPDATE\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING)\b|;|$)/gi
const TABLES_MODULE = /(^|\/)tables(\.[cm]?js|\.ts)?$/
const TABLES_FILE = /(^|[\\/])src[\\/]db[\\/]tables\.ts$/
const HELPER_MODULE = /^(\.\/|@\/db\/)(table|wipe)$/
const DESCRIPTOR_CONSUMERS = new Set(['select', 'selectAll', 'deleteEveryRow'])
const NAME_HELPERS = new Set(['identifier', 'raw'])

function columnMatcher(columns) {
  if (columns === EVERY_COLUMN) return () => true
  const pattern = new RegExp(String.raw`\b(?:${columns.join('|')})\b`, 'i')
  return (text) => pattern.test(text)
}

function compileTable(table) {
  const name = String.raw`(?:"?public"?\s*\.\s*)?"?${table.name}"?`
  return {
    name: table.name,
    details: table.details,
    definition: new RegExp(String.raw`^${name}$`, 'i'),
    updateSet: new RegExp(
      String.raw`\bUPDATE\s+(?:ONLY\s+)?${name}(?:\s*\*)?(?:\s+(?:AS\s+)?(?!SET\b)(?:[A-Za-z_]\w*|"[^"]*"))?\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING)\b|\s(?<!\bIS\s+(?:NOT\s+)?DISTINCT\s+)FROM\b|;|$)`,
      'gi'
    ),
    insertInto: new RegExp(String.raw`\bINSERT\s+INTO\s+${name}(?!\w)`, 'i'),
    truncate: new RegExp(String.raw`\bTRUNCATE\b[^;]*?\b${table.name}\b`, 'i'),
    deleteFrom: new RegExp(String.raw`\bDELETE\s+FROM\s+(?:ONLY\s+)?${name}(?!\w)`, 'i'),
    mergeInto: new RegExp(String.raw`\bMERGE\s+INTO\s+${name}(?!\w)`, 'i'),
    writesOwnedColumn: columnMatcher(table.columns),
    ownsUnknownConflictTarget: table.columns !== EVERY_COLUMN,
  }
}

function memberName(node) {
  if (node.type !== 'MemberExpression') return null
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal') return String(node.property.value)
  return null
}

function calleeName(callee) {
  return callee.type === 'Identifier' ? callee.name : memberName(callee)
}

function staticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked
  }
  return null
}

function inlinedName(expression) {
  if (expression.type !== 'CallExpression' || expression.arguments.length !== 1) return null
  if (!NAME_HELPERS.has(calleeName(expression.callee))) return null
  return staticString(expression.arguments[0])
}

function hole(expression, index) {
  return inlinedName(expression) ?? `${HOLE}${index}${HOLE}`
}

function templateText(node) {
  return node.quasis
    .map((quasi, index) => {
      const expression = node.expressions[index]
      return `${quasi.value.cooked ?? ''}${expression ? hole(expression, index) : ''}`
    })
    .join('')
}

function isConcatenation(node) {
  return node.type === 'BinaryExpression' && node.operator === '+'
}

function concatenation(node) {
  const expressions = []
  const pieces = []
  function visit(piece) {
    if (isConcatenation(piece)) {
      visit(piece.left)
      visit(piece.right)
      return
    }
    const text = staticString(piece)
    if (text !== null) {
      pieces.push(text)
      return
    }
    pieces.push(hole(piece, expressions.length))
    expressions.push(piece)
  }
  visit(node)
  return { text: pieces.join(''), expressions }
}

function sqlLevels(text) {
  const levels = ['']
  const open = [0]
  for (const [token] of text.matchAll(SQL_TOKEN)) {
    const current = open[open.length - 1]
    if (token === '(') {
      const inline = ROW_CONSTRUCTOR.test(levels[current])
      levels[current] += '('
      if (!inline) levels.push('')
      open.push(inline ? current : levels.length - 1)
    } else if (token === ')') {
      if (open.length > 1) open.pop()
      levels[open[open.length - 1]] += ')'
    } else if (token.startsWith(HOLE)) {
      for (const level of new Set(open)) levels[level] += token
    } else if (COMMENT.test(token)) {
      levels[current] += ' '
    } else if (QUOTED.test(token)) {
      levels[current] += "''"
    } else {
      levels[current] += token
    }
  }
  return levels
}

function setClauses(level, table) {
  return [...level.matchAll(table.updateSet)].map((match) => match[1])
}

function writesLifecycle(level, tables) {
  const target = INSERT_TARGET.exec(level)?.[1].toLowerCase()
  const conflictClauses = [...level.matchAll(DO_UPDATE_SET)].map((match) => match[1])
  return tables.some((table) => {
    if ([table.insertInto, table.deleteFrom, table.truncate].some((write) => write.test(level))) {
      return true
    }
    if (setClauses(level, table).some(table.writesOwnedColumn)) return true
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

function holes(clause) {
  return [...clause.matchAll(HOLE_INDEX)].map((match) => Number(match[1]))
}

function columnHoles(clause) {
  const found = []
  let depth = 0
  let columnNext = true
  for (const token of clause.matchAll(/\u0000(\d+)\u0000|\S/g)) {
    if (token[1] !== undefined) {
      if (depth === 0 && columnNext) found.push(Number(token[1]))
      columnNext = false
      continue
    }
    if (token[0] === '(') depth += 1
    if (token[0] === ')') depth -= 1
    columnNext = depth === 0 && token[0] === ','
  }
  return found
}

function resolve(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable) return variable
  }
  return null
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
      const { sourceCode } = context
      const inTablesFile = TABLES_FILE.test(context.filename)

      function* callsNamed(node, name) {
        if (node.type === 'CallExpression' && calleeName(node.callee) === name) yield node
        for (const key of sourceCode.visitorKeys[node.type] ?? []) {
          const children = Array.isArray(node[key]) ? node[key] : [node[key]]
          for (const child of children) if (child) yield* callsNamed(child, name)
        }
      }

      function checkStatement(node, text, expressions) {
        const levels = sqlLevels(text)
        if (levels.some((level) => writesLifecycle(level, tables))) {
          context.report({ node, messageId: 'lifecycle' })
        }
        if (levels.some((level) => tables.some((table) => table.mergeInto.test(level)))) {
          context.report({ node, messageId: 'merge' })
        }
        const foreign = new Set()
        const raws = new Set()
        for (const table of tables.filter((table) => table.details !== undefined)) {
          for (const clause of levels.flatMap((level) => setClauses(level, table))) {
            for (const index of columnHoles(clause)) {
              if (!isDetailsSet(expressions[index], table.details)) foreign.add(expressions[index])
            }
            for (const index of holes(clause)) {
              if (foreign.has(expressions[index])) continue
              for (const call of callsNamed(expressions[index], 'raw')) raws.add(call)
            }
          }
        }
        for (const expression of foreign) {
          context.report({ node: expression, messageId: 'interpolation' })
        }
        for (const call of raws) context.report({ node: call, messageId: 'raw' })
      }

      function isReadHelperArgument(identifier) {
        const call = identifier.parent
        if (
          call.type !== 'CallExpression' ||
          call.callee.type !== 'Identifier' ||
          call.arguments[0] !== identifier
        ) {
          return false
        }
        const definition = resolve(sourceCode.getScope(call), call.callee.name)?.defs[0]
        return (
          definition?.type === 'ImportBinding' &&
          definition.node.type === 'ImportSpecifier' &&
          DESCRIPTOR_CONSUMERS.has(definition.node.imported.name) &&
          HELPER_MODULE.test(String(definition.parent.source.value))
        )
      }

      function checkModuleSource(node, source) {
        if (source && TABLES_MODULE.test(String(source.value))) {
          context.report({ node, messageId: 'module' })
        }
      }

      function checkNamespaceReference(reference) {
        const member = reference.identifier.parent
        if (member.type !== 'MemberExpression' || member.object !== reference.identifier) {
          context.report({ node: reference.identifier, messageId: 'module' })
        } else if (memberName(member) === null) {
          context.report({ node: member, messageId: 'module' })
        } else if (descriptors.has(memberName(member))) {
          context.report({ node: member, messageId: 'descriptor' })
        }
      }

      function checkImport(node) {
        if (!TABLES_MODULE.test(String(node.source.value))) return
        for (const specifier of node.specifiers) {
          const [variable] = sourceCode.getDeclaredVariables(specifier)
          const imported = specifier.type === 'ImportSpecifier' ? specifier.imported.name : null
          if (specifier.type === 'ImportNamespaceSpecifier' || imported === 'tables') {
            variable.references.forEach(checkNamespaceReference)
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

      function checkCall(node) {
        const name = calleeName(node.callee)
        if (name === 'require' && node.arguments[0]) checkModuleSource(node, node.arguments[0])
        if (name !== 'defineTable' || inTablesFile || !node.arguments[0]) return
        const table = staticString(node.arguments[0])
        if (table !== null && tables.some((owned) => owned.definition.test(table))) {
          context.report({ node, messageId: 'definition' })
        }
      }

      return {
        ImportDeclaration: checkImport,
        ImportExpression(node) {
          checkModuleSource(node, node.source)
        },
        ExportNamedDeclaration(node) {
          checkModuleSource(node, node.source)
        },
        ExportAllDeclaration(node) {
          checkModuleSource(node, node.source)
        },
        CallExpression: checkCall,
        Literal(node) {
          if (typeof node.value !== 'string' || isConcatenation(node.parent)) return
          checkStatement(node, node.value, [])
        },
        BinaryExpression(node) {
          if (!isConcatenation(node) || isConcatenation(node.parent)) return
          const { text, expressions } = concatenation(node)
          checkStatement(node, text, expressions)
        },
        TemplateLiteral(node) {
          checkStatement(node, templateText(node), node.expressions)
        },
      }
    },
  }
}

const smsLifecycleOwner = lifecycleOwner({
  description:
    'Flags SQL text outside src/db/sms-support-lifecycle.ts that inserts SMS support tickets, writes their status columns, or writes support jobs',
  tables: [
    {
      name: 'sms_support_tickets',
      descriptor: 'smsSupportTickets',
      details: 'smsSupportTicketDetails',
      columns: ['status', 'state', 'automation_status', 'closed_at'],
    },
    {
      name: 'sms_support_jobs',
      descriptor: 'smsSupportJobs',
      columns: EVERY_COLUMN,
    },
  ],
  messages: {
    lifecycle:
      'Only src/db/sms-support-lifecycle.ts inserts SMS support tickets, writes their status, state, automation_status and closed_at, and inserts or updates sms_support_jobs. Delete or truncate either table only through deleteEveryRow. Write other ticket columns with set(smsSupportTicketDetails, ...) and move tickets and jobs through the lifecycle.',
    interpolation:
      'Inside the SET clause of an UPDATE of sms_support_tickets, interpolate only set(smsSupportTicketDetails, ...). Name every other column in the SQL text, and change status, state, automation_status or closed_at through src/db/sms-support-lifecycle.ts.',
    raw: 'Inside the SET clause of an UPDATE of sms_support_tickets, raw() is refused in every position, the values of a set(smsSupportTicketDetails, ...) patch included, because its text can name status, state, automation_status or closed_at. Name the column in the SQL text and pass the value as a parameter.',
    descriptor:
      'Outside src/db/sms-support-lifecycle.ts the smsSupportTickets and smsSupportJobs descriptors are only read or wiped. Pass each under its own name, only as the first argument of select, selectAll or deleteEveryRow imported from the table or wipe module. Write other ticket columns with set(smsSupportTicketDetails, ...) and change status or jobs through the lifecycle.',
    module:
      'The tables module is imported statically and its descriptors by name; it is not re-exported, destructured, aliased, indexed or loaded with require() or import().',
    definition:
      'sms_support_tickets and sms_support_jobs each have one descriptor, in src/db/tables.ts; a second defineTable of either would write around the lifecycle.',
    merge:
      'MERGE INTO sms_support_tickets or sms_support_jobs is refused; it can set any column. Use the lifecycle.',
  },
})

const plugin = { rules: { 'sms-lifecycle-owner': smsLifecycleOwner } }

export default plugin
