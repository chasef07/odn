const HOLE = '\u0000'
const SQL_TOKEN = new RegExp(
  String.raw`\u0000\d+\u0000|--[^\n]*|/\*[\s\S]*?(?:\*/|$)|'(?:[^']|'')*(?:'|$)|"(?:[^"\u0000]|"")*(?:"|$)|\$([A-Za-z_]\w*)?\$[\s\S]*?(?:\$\1\$|$)|[()]|[^\u0000'"$()/-]+|[\s\S]`,
  'g'
)
const QUOTED = /^(?:'|\$\w*\$)/
const COMMENT = /^(?:--|\/\*)/
const TABLE = String.raw`(?:"?public"?\s*\.\s*)?"?submissions"?`
const ALIAS = String.raw`(?:[A-Za-z_]\w*|"[^"]*")`
const INTO_TABLE = String.raw`\bINTO\s+${TABLE}(?![\w"])(?:\s+AS\s+${ALIAS})?`
const INLINE_GROUP = new RegExp(String.raw`(?:\bSET|,|${INTO_TABLE})\s*$`, 'i')
const UPDATE_SET = new RegExp(
  String.raw`\bUPDATE\s+(?:ONLY\s+)?${TABLE}(?:\s*\*)?(?:\s+(?:AS\s+)?(?!SET\b)${ALIAS})?\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING)\b|\s(?<!\bIS\s+(?:NOT\s+)?DISTINCT\s+)FROM\b|;|$)`,
  'gi'
)
const INSERT_INTO = new RegExp(String.raw`\bINSERT\s+${INTO_TABLE}\s*(?:\(([^()]*)\))?`, 'gi')
const MERGE_INTO = new RegExp(String.raw`\bMERGE\s+INTO\s+${TABLE}(?![\w"])`, 'i')
const DO_UPDATE_SET = /\bDO\s+UPDATE\s+SET\b([\s\S]*?)(?=\s(?:WHERE|RETURNING)\b|;|$)/gi
const LIFECYCLE_COLUMN = /\b(?:status|stripe_refund_id|refunded_at)\b/i
const REFUND_COLUMN = /\b(?:stripe_refund_id|refunded_at)\b/i
const TABLE_NAME = new RegExp(String.raw`^${TABLE}$`, 'i')

const TABLES_MODULE = /(^|\/)tables(\.[cm]?js|\.ts)?$/
const TABLES_FILE = /(^|[\\/])src[\\/]db[\\/]tables\.ts$/
const HELPER_MODULE = /^(\.\/|@\/db\/)(table|wipe)$/
const DESCRIPTOR_CONSUMERS = new Set(['select', 'selectAll', 'deleteEveryRow'])
const NAME_HELPERS = new Set(['identifier', 'raw'])

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

function isConcatenation(node) {
  return node.type === 'BinaryExpression' && node.operator === '+'
}

function isSqlFragment(node) {
  return (
    node.type === 'TaggedTemplateExpression' &&
    node.tag.type === 'Identifier' &&
    node.tag.name === 'sql'
  )
}

function isInlinedIntoParent(node) {
  const { parent } = node
  if (isConcatenation(parent)) return true
  return (
    isSqlFragment(parent) &&
    (parent.parent.type === 'TemplateLiteral' || isConcatenation(parent.parent))
  )
}

function sqlText(root) {
  const pieces = []
  const expressions = []
  function interpolate(expression) {
    const name = inlinedName(expression)
    if (name !== null) {
      pieces.push(name)
    } else if (isSqlFragment(expression)) {
      visit(expression.quasi)
    } else {
      pieces.push(`${HOLE}${expressions.length}${HOLE}`)
      expressions.push(expression)
    }
  }
  function visit(node) {
    if (isConcatenation(node)) {
      visit(node.left)
      visit(node.right)
    } else if (node.type === 'TemplateLiteral') {
      node.quasis.forEach((quasi, index) => {
        pieces.push(quasi.value.cooked ?? '')
        if (node.expressions[index]) interpolate(node.expressions[index])
      })
    } else if (node.type === 'Literal' && typeof node.value === 'string') {
      pieces.push(node.value)
    } else {
      interpolate(node)
    }
  }
  visit(root)
  return { text: pieces.join(''), expressions }
}

function sqlLevels(text) {
  const levels = ['']
  const open = [0]
  for (const [token] of text.matchAll(SQL_TOKEN)) {
    const current = open[open.length - 1]
    if (token === '(') {
      const inline = INLINE_GROUP.test(levels[current])
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

function setClauses(level) {
  return [...level.matchAll(UPDATE_SET)].map((match) => match[1])
}

function writesLifecycle(level) {
  if (setClauses(level).some((clause) => LIFECYCLE_COLUMN.test(clause))) return true
  for (const [, columns] of level.matchAll(INSERT_INTO)) {
    if (columns === undefined || REFUND_COLUMN.test(columns)) return true
  }
  return [...level.matchAll(DO_UPDATE_SET)].some((match) => LIFECYCLE_COLUMN.test(match[1]))
}

function isDetailsSet(expression) {
  return (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'set' &&
    expression.arguments[0]?.type === 'Identifier' &&
    expression.arguments[0].name === 'submissionDetails'
  )
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

const lifecycleOwner = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Flags SQL text and descriptor uses outside src/db/submission-lifecycle.ts that write a submission's status or refund columns",
    },
    schema: [],
    messages: {
      lifecycle:
        "This SQL writes a submission's status, stripe_refund_id or refunded_at, or inserts a submission without a column list. Change status and refunds through src/db/submission-lifecycle.ts, write other columns with set(submissionDetails, ...), and insert rows with insert(submissionBirth, ...).",
      interpolation:
        'Inside the SET clause of an UPDATE of submissions, interpolate only set(submissionDetails, ...) in column position. Name every other column in the SQL text.',
      descriptor:
        'Outside src/db/submission-lifecycle.ts, pass the submissions descriptor under its own name, only as the first argument of select, selectAll or deleteEveryRow imported from the table or wipe module. Write other columns with set(submissionDetails, ...) and change status or refunds through the lifecycle.',
      module:
        'Import the tables module statically and its descriptors by name. Do not re-export, destructure, alias or index it, or load it with require() or import().',
      definition:
        'Define submissions once, in src/db/tables.ts. A second defineTable of it would write around the lifecycle.',
      merge: 'MERGE INTO submissions can set any column. Use the lifecycle.',
    },
  },
  create(context) {
    const { sourceCode } = context
    const inTablesFile = TABLES_FILE.test(context.filename)

    function checkStatement(node) {
      const { text, expressions } = sqlText(node)
      const levels = sqlLevels(text)
      if (levels.some(writesLifecycle)) context.report({ node, messageId: 'lifecycle' })
      if (levels.some((level) => MERGE_INTO.test(level))) {
        context.report({ node, messageId: 'merge' })
      }
      for (const clause of levels.flatMap(setClauses)) {
        for (const index of columnHoles(clause)) {
          if (!isDetailsSet(expressions[index])) {
            context.report({ node: expressions[index], messageId: 'interpolation' })
          }
        }
      }
    }

    function isDescriptorConsumerArgument(identifier) {
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
      } else if (memberName(member) === 'submissions') {
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
        if (imported !== 'submissions') continue
        if (specifier.local.name !== 'submissions') {
          context.report({ node: specifier, messageId: 'descriptor' })
        }
        for (const reference of variable.references) {
          if (!isDescriptorConsumerArgument(reference.identifier)) {
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
      if (table !== null && TABLE_NAME.test(table)) {
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
        checkStatement(node)
      },
      BinaryExpression(node) {
        if (!isConcatenation(node) || isInlinedIntoParent(node)) return
        checkStatement(node)
      },
      TemplateLiteral(node) {
        if (isInlinedIntoParent(node)) return
        checkStatement(node)
      },
    }
  },
}

const plugin = { rules: { 'lifecycle-owner': lifecycleOwner } }

export default plugin
