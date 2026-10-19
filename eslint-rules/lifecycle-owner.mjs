import { statementText } from './no-sql.mjs'

const UPDATE_SET = /UPDATE\s+"?submissions"?\s+SET\s([\s\S]*?)(?:\sWHERE\s|\sRETURNING\s|$)/
const INSERT_INTO = /INSERT\s+INTO\s+"?submissions"?[\s(]([\s\S]*)/
const LIFECYCLE_COLUMN = /\b(status|stripe_refund_id|refunded_at)\b/
const REFUND_COLUMN = /\b(stripe_refund_id|refunded_at)\b/
const REFUND_KEYS = new Set(['stripeRefundId', 'refundedAt'])

function writesLifecycleColumn(text) {
  const update = UPDATE_SET.exec(text)
  if (update && LIFECYCLE_COLUMN.test(update[1])) return true
  const insert = INSERT_INTO.exec(text)
  return Boolean(insert && REFUND_COLUMN.test(insert[1]))
}

function propertyName(property) {
  if (property.type !== 'Property' || property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'Literal') return String(property.key.value)
  return null
}

function setsRefundColumn(object) {
  return object.properties.some((property) => REFUND_KEYS.has(propertyName(property)))
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
        "Only src/db/submission-lifecycle.ts writes a submission's status, stripe_refund_id and refunded_at. Write other columns with set(submissionDetails, ...) and change status or refunds through the lifecycle.",
    },
  },
  create(context) {
    function checkText(node) {
      const text = statementText(node)
      if (text !== null && writesLifecycleColumn(text)) {
        context.report({ node, messageId: 'lifecycle' })
      }
    }
    return {
      Literal: checkText,
      TemplateLiteral: checkText,
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return
        const [table, values] = node.arguments
        if (table?.type !== 'Identifier' || table.name !== 'submissions') return
        const isSet = node.callee.name === 'set'
        const isRefundInsert =
          node.callee.name === 'insert' &&
          values?.type === 'ObjectExpression' &&
          setsRefundColumn(values)
        if (isSet || isRefundInsert) context.report({ node, messageId: 'lifecycle' })
      },
    }
  },
}

const plugin = { rules: { 'lifecycle-owner': lifecycleOwner } }

export default plugin
