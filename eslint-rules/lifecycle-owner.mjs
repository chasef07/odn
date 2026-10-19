const HOLE = '\u0000'
const TABLE = String.raw`(?:"?public"?\.)?"?submissions"?`
const GAP = String.raw`(?:\s|/\*[\s\S]*?\*/|--[^\n]*\n)+`
const UPDATE_SET = new RegExp(
  String.raw`\bUPDATE${GAP}(?:ONLY${GAP})?${TABLE}(?:${GAP}(?:AS${GAP})?(?!SET\b)[A-Za-z_]\w*)?${GAP}SET\s([\s\S]*?)(?=\s(?:WHERE|RETURNING|FROM)\s|;|$)`,
  'gi'
)
const MERGE_INTO = new RegExp(String.raw`\bMERGE\s+INTO\s+${TABLE}(?!\w)`, 'i')
const INSERT_INTO = new RegExp(String.raw`\bINSERT\s+INTO\s+${TABLE}[\s(]([\s\S]*)`, 'i')

const DO_UPDATE_SET = /\bDO\s+UPDATE\s+SET\s([\s\S]*?)(?=\s(?:WHERE|RETURNING)\s|;|$)/gi
const LIFECYCLE_COLUMN = /\b(status|stripe_refund_id|refunded_at)\b/i
const REFUND_COLUMN = /\b(stripe_refund_id|refunded_at)\b/i
const TABLE_NAME = new RegExp(String.raw`^${TABLE}$`, 'i')

const TABLES_MODULE = /(^|\/)tables$/
const TABLES_FILE = /(^|[\\/])src[\\/]db[\\/]tables\.ts$/
const HELPER_MODULE = /^(\.\/|@\/db\/)(table|wipe)$/
const DESCRIPTOR_CONSUMERS = new Set(['select', 'selectAll', 'deleteEveryRow'])
const NAME_HELPERS = new Set(['identifier', 'raw'])

function staticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked
  }
  return null
}

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name
  return memberName(callee)
}

function inlinedName(expression) {
  if (expression.type !== 'CallExpression' || expression.arguments.length !== 1) return null
  if (!NAME_HELPERS.has(calleeName(expression.callee))) return null
  return staticString(expression.arguments[0])
}

function templateText(node) {
  return node.quasis
    .map((quasi, index) => {
      const expression = node.expressions[index]
      const hole = expression ? (inlinedName(expression) ?? `${HOLE}${index}${HOLE}`) : ''
      return `${quasi.value.cooked ?? ''}${hole}`
    })
    .join('')
}

function concatenatedText(node) {
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return `${concatenatedText(node.left)}${concatenatedText(node.right)}`
  }
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : ' '
}

function isConcatenation(node) {
  return node.type === 'BinaryExpression' && node.operator === '+'
}

function updateClauses(text) {
  return [...text.matchAll(UPDATE_SET)].map((match) => match[1])
}

function writesLifecycleColumn(text) {
  if (updateClauses(text).some((clause) => LIFECYCLE_COLUMN.test(clause))) return true
  const insert = INSERT_INTO.exec(text)
  if (insert && REFUND_COLUMN.test(insert[1])) return true
  return [...text.matchAll(DO_UPDATE_SET)].some((match) => LIFECYCLE_COLUMN.test(match[1]))
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
  const holes = []
  let depth = 0
  let columnNext = true
  for (const token of clause.matchAll(/\u0000(\d+)\u0000|\S/g)) {
    if (token[1] !== undefined) {
      if (columnNext) holes.push(Number(token[1]))
      columnNext = false
      continue
    }
    if (token[0] === '(') depth += 1
    if (token[0] === ')') depth -= 1
    columnNext = depth === 0 && token[0] === ','
  }
  return holes
}

function foreignSetInterpolations(node) {
  const text = templateText(node)
  return updateClauses(text).flatMap((clause) =>
    columnHoles(clause)
      .map((index) => node.expressions[index])
      .filter((expression) => !isDetailsSet(expression))
  )
}

function memberName(node) {
  if (node.type !== 'MemberExpression') return null
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal') return String(node.property.value)
  return null
}

function resolve(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable) return variable
  }
  return null
}

function isDescriptorConsumerArgument(context, identifier) {
  const call = identifier.parent
  if (
    call.type !== 'CallExpression' ||
    call.callee.type !== 'Identifier' ||
    call.arguments[0] !== identifier
  ) {
    return false
  }
  const definition = resolve(context.sourceCode.getScope(call), call.callee.name)?.defs[0]
  return (
    definition?.type === 'ImportBinding' &&
    definition.node.type === 'ImportSpecifier' &&
    DESCRIPTOR_CONSUMERS.has(definition.node.imported.name) &&
    HELPER_MODULE.test(String(definition.parent.source.value))
  )
}

const lifecycleOwner = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Only src/db/submission-lifecycle.ts writes a submission's status and refund columns",
    },
    schema: [],
    messages: {
      lifecycle:
        "Only src/db/submission-lifecycle.ts writes a submission's status, stripe_refund_id and refunded_at. Write other columns with set(submissionDetails, ...), insert rows with insert(submissionBirth, ...), and change status or refunds through the lifecycle.",
      interpolation:
        'An UPDATE of submissions interpolates only set(submissionDetails, ...) inside SET; name every other column in the text.',
      descriptor:
        'Outside src/db/submission-lifecycle.ts the submissions descriptor is only read or wiped: pass it, under its own name, only as the first argument of select, selectAll or deleteEveryRow imported from the table or wipe module.',
      module:
        'The tables module is imported statically and its descriptors by name; it is not re-exported, destructured, aliased, indexed or loaded with import().',
      definition:
        'submissions has one descriptor, in src/db/tables.ts; a second defineTable of it would write around the lifecycle.',
      merge: 'MERGE INTO submissions is refused; it can set any column. Use the lifecycle.',
    },
  },
  create(context) {
    const inTablesFile = TABLES_FILE.test(context.filename)
    function checkText(node, text) {
      if (writesLifecycleColumn(text)) context.report({ node, messageId: 'lifecycle' })
      if (MERGE_INTO.test(text)) context.report({ node, messageId: 'merge' })
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
        const [variable] = context.sourceCode.getDeclaredVariables(specifier)
        const imported = specifier.type === 'ImportSpecifier' ? specifier.imported.name : null
        if (specifier.type === 'ImportNamespaceSpecifier' || imported === 'tables') {
          variable.references.forEach(checkNamespaceReference)
        }
        if (imported !== 'submissions') continue
        if (specifier.local.name !== 'submissions') {
          context.report({ node: specifier, messageId: 'descriptor' })
        }
        for (const reference of variable.references) {
          if (!isDescriptorConsumerArgument(context, reference.identifier)) {
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
        checkText(node, node.value)
      },
      BinaryExpression(node) {
        if (!isConcatenation(node) || isConcatenation(node.parent)) return
        checkText(node, concatenatedText(node))
      },
      TemplateLiteral(node) {
        checkText(node, templateText(node))
        for (const expression of foreignSetInterpolations(node)) {
          context.report({ node: expression, messageId: 'interpolation' })
        }
      },
    }
  },
}

const plugin = { rules: { 'lifecycle-owner': lifecycleOwner } }

export default plugin
