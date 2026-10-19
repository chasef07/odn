const HOLE = '\u0000'
const TABLE = String.raw`(?:"?public"?\.)?"?submissions"?`
const UPDATE_SET = new RegExp(
  String.raw`\bUPDATE\s+${TABLE}(?:\s+(?:AS\s+)?(?!SET\b)[A-Za-z_]\w*)?\s+SET\s([\s\S]*?)(?=\s(?:WHERE|RETURNING|FROM)\s|;|$)`,
  'gi'
)
const INSERT_INTO = new RegExp(String.raw`\bINSERT\s+INTO\s+${TABLE}[\s(]([\s\S]*)`, 'i')
const INSERT_TARGET = /\bINSERT\s+INTO\s+(?:"?public"?\.)?"?(\w+)"?/i
const DO_UPDATE_SET = /\bDO\s+UPDATE\s+SET\s([\s\S]*?)(?=\s(?:WHERE|RETURNING)\s|;|$)/gi
const LIFECYCLE_COLUMN = /\b(status|stripe_refund_id|refunded_at)\b/i
const REFUND_COLUMN = /\b(stripe_refund_id|refunded_at)\b/i

const TABLES_MODULE = /(^|\/)tables$/
const DESCRIPTOR_CONSUMERS = new Set(['select', 'selectAll', 'deleteEveryRow'])

function templateText(node) {
  return node.quasis
    .map((quasi, index) => `${quasi.value.cooked ?? ''}${HOLE}${index}${HOLE}`)
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
  const target = INSERT_TARGET.exec(text)?.[1].toLowerCase()
  if (target !== undefined && target !== 'submissions') return false
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

function isReadHelperArgument(identifier) {
  const call = identifier.parent
  return (
    call.type === 'CallExpression' &&
    call.callee.type === 'Identifier' &&
    DESCRIPTOR_CONSUMERS.has(call.callee.name) &&
    call.arguments[0] === identifier
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
        'Outside src/db/submission-lifecycle.ts the submissions descriptor is only read or wiped: pass it, under its own name, only as the first argument of select, selectAll or deleteEveryRow.',
    },
  },
  create(context) {
    function checkText(node, text) {
      if (writesLifecycleColumn(text)) context.report({ node, messageId: 'lifecycle' })
    }
    function checkImport(node) {
      if (!TABLES_MODULE.test(String(node.source.value))) return
      for (const specifier of node.specifiers) {
        const [variable] = context.sourceCode.getDeclaredVariables(specifier)
        const imported = specifier.type === 'ImportSpecifier' ? specifier.imported.name : null
        if (specifier.type === 'ImportNamespaceSpecifier' || imported === 'tables') {
          for (const reference of variable.references) {
            const member = reference.identifier.parent
            if (member.object === reference.identifier && memberName(member) === 'submissions') {
              context.report({ node: member, messageId: 'descriptor' })
            }
          }
        }
        if (imported !== 'submissions') continue
        if (specifier.local.name !== 'submissions') {
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
        for (const expression of foreignSetInterpolations(node)) {
          context.report({ node: expression, messageId: 'interpolation' })
        }
      },
    }
  },
}

const plugin = { rules: { 'lifecycle-owner': lifecycleOwner } }

export default plugin
