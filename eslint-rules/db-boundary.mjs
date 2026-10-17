import path from 'node:path'

const TABLE_MODULES = {
  submission: 'src/db/submissions.ts',
  noteVerification: 'src/db/note-verifications.ts',
  temporarySubmission: 'src/db/temporary-submissions.ts',
  smsPhoneState: 'src/db/sms-support.ts',
  smsMessage: 'src/db/sms-support.ts',
  smsSupportTicket: 'src/db/sms-support.ts',
  smsSupportJob: 'src/db/sms-support.ts',
  telnyxWebhookEvent: 'src/db/webhook-events.ts',
  resendWebhookEvent: 'src/db/webhook-events.ts',
  user: 'src/db/auth.ts',
  account: 'src/db/auth.ts',
  session: 'src/db/auth.ts',
}

const MODULE_LIST = [...new Set(Object.values(TABLE_MODULES))].join(', ')

const CLIENT_FILES = new Set(['src/db/client', 'src/db/pool', 'src/lib/prisma'])
const INTERNAL_FILES = new Set(['src/db/errors', 'src/lib/prisma-errors'])
const TEST_DATABASE = 'src/db/test-database'

function repoPath(context, source) {
  let resolved
  if (source.startsWith('@/')) {
    resolved = path.join('src', source.slice(2))
  } else if (source.startsWith('.')) {
    const relativeFile = path.relative(context.cwd, context.filename)
    resolved = path.join(path.dirname(relativeFile), source)
  } else {
    return null
  }
  return resolved.replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '')
}

function classify(context, source) {
  if (source === '@prisma/client' || source.startsWith('@prisma/client/')) return 'prismaClient'
  if (source === 'pg' || source.startsWith('pg/')) return 'pg'
  const file = repoPath(context, source)
  if (!file) return null
  if (CLIENT_FILES.has(file)) return 'dbClient'
  if (INTERNAL_FILES.has(file)) return 'dbInternal'
  if (file === TEST_DATABASE) return 'testDatabase'
  return null
}

function stringArgument(node) {
  const [first] = node.arguments
  if (first?.type === 'Literal' && typeof first.value === 'string') return first.value
  if (first?.type === 'TemplateLiteral' && first.expressions.length === 0) {
    return first.quasis[0].value.cooked
  }
  return null
}

function isModuleCall(node) {
  const callee = node.callee
  if (callee.type === 'Identifier' && callee.name === 'require') return true
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'vi' &&
    callee.property.type === 'Identifier' &&
    ['mock', 'doMock', 'importActual', 'importMock'].includes(callee.property.name)
  )
}

const dbBoundary = {
  meta: {
    type: 'problem',
    docs: { description: 'Only src/db talks to the database' },
    schema: [],
    messages: {
      prismaClient: `Import domain types and status constants from '@/db/types', not {{source}}. Queries live in a named function in the src/db module for their table (${MODULE_LIST}).`,
      pg: `Only src/db talks to Postgres. Add a named query function to the src/db module for the table (${MODULE_LIST}).`,
      dbClient: `{{source}} is the database client, and only src/db may use it. Call a named function from the src/db module for the table (${MODULE_LIST}). Tests mock that module's functions.`,
      dbInternal:
        '{{source}} is internal to src/db. The src/db function catches the database error and returns a domain result the caller branches on.',
      testDatabase:
        '{{source}} boots the PGlite test database and is only for src/db/**/*.db.test.ts and vitest.db-setup.ts. Other tests mock the src/db functions.',
      query:
        'Move this {{model}} query into a named function in {{module}} and call that function here.',
    },
  },
  create(context) {
    const clientBindings = new Set()

    function check(node, source) {
      const messageId = classify(context, source)
      if (messageId) context.report({ node, messageId, data: { source } })
      return messageId
    }

    return {
      ImportDeclaration(node) {
        if (check(node, node.source.value) !== 'dbClient') return
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportNamespaceSpecifier')
            clientBindings.add(specifier.local.name)
        }
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node, node.source.value)
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        check(node, node.source.value)
      },
      CallExpression(node) {
        if (!isModuleCall(node)) return
        const source = stringArgument(node)
        if (source) check(node, source)
      },
      MemberExpression(node) {
        if (
          node.object.type !== 'Identifier' ||
          !clientBindings.has(node.object.name) ||
          node.computed ||
          node.property.type !== 'Identifier'
        ) {
          return
        }
        const tableModule = TABLE_MODULES[node.property.name]
        if (tableModule) {
          context.report({
            node,
            messageId: 'query',
            data: { model: node.property.name, module: tableModule },
          })
        }
      },
    }
  },
}

const plugin = { rules: { 'db-boundary': dbBoundary } }

export default plugin
