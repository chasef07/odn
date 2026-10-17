const DIRECT_ENV_VARS = new Set(['NODE_ENV', 'NEXT_RUNTIME'])

const SDK_OWNERS = {
  Stripe: { file: 'src/lib/stripe.ts', use: "`stripe` from '@/lib/stripe'" },
  Resend: { file: 'src/lib/email.ts', use: "`resend` from '@/lib/email'" },
  PrismaClient: { file: 'src/db/client.ts', use: 'a named query function from a src/db module' },
}

const OWNER_FILES = Object.values(SDK_OWNERS)
  .map((owner) => owner.file)
  .join(', ')

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

function isProcessEnv(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'env'
  )
}

function staticPropertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name
  if (member.computed && member.property.type === 'Literal') return String(member.property.value)
  return null
}

function envVarName(processEnvNode) {
  const parent = processEnvNode.parent
  if (parent.type !== 'MemberExpression' || parent.object !== processEnvNode) return null
  return staticPropertyName(parent)
}

function relativePath(context) {
  const prefix = `${context.cwd}/`
  return context.filename.startsWith(prefix)
    ? context.filename.slice(prefix.length)
    : context.filename
}

function atModuleScope(context, node) {
  return !context.sourceCode
    .getAncestors(node)
    .some((ancestor) => FUNCTION_TYPES.has(ancestor.type))
}

const noProcessEnv = {
  meta: {
    type: 'problem',
    docs: { description: 'Read env vars only through src/lib/env.ts and src/lib/public-env.ts' },
    schema: [],
    messages: {
      server:
        "Read {{name}} as env.{{name}} from '@/lib/env'. A new var gets a schema entry there, with no default URL or name.",
      public:
        "Read {{name}} as publicEnv.{{name}} from '@/lib/public-env'. A new public var gets a getter there that reads process.env.{{name}} literally, so Next inlines it.",
      dynamic:
        "Read one var at a time as env.X from '@/lib/env' or publicEnv.X from '@/lib/public-env'. Next inlines only literal process.env.NEXT_PUBLIC_X reads, so a destructured or computed read is undefined in the browser.",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!isProcessEnv(node)) return
        const name = envVarName(node)
        if (!name) {
          context.report({ node, messageId: 'dynamic' })
          return
        }
        if (DIRECT_ENV_VARS.has(name)) return
        const messageId = name.startsWith('NEXT_PUBLIC_') ? 'public' : 'server'
        context.report({ node, messageId, data: { name } })
      },
    }
  },
}

const noSdkClient = {
  meta: {
    type: 'problem',
    docs: { description: 'Construct SDK clients only in their owner module' },
    schema: [],
    messages: {
      sdk: '`new {{name}}()` belongs only in {{file}}. Use {{use}}.',
    },
  },
  create(context) {
    const file = relativePath(context)
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return
        const owner = SDK_OWNERS[node.callee.name]
        if (!owner || owner.file === file) return
        context.report({
          node,
          messageId: 'sdk',
          data: { name: node.callee.name, file: owner.file, use: owner.use },
        })
      },
    }
  },
}

const noImportTimeConfig = {
  meta: {
    type: 'problem',
    docs: { description: 'Read server config and construct SDK clients only inside functions' },
    schema: [],
    messages: {
      config: `{{what}} runs when this module is imported, so a build or test without that config crashes on import. Read it inside the function that uses it, and construct SDK clients lazily in their owner module (${OWNER_FILES}).`,
    },
  },
  create(context) {
    const envBindings = new Set()

    function report(node, what) {
      if (atModuleScope(context, node)) {
        context.report({ node, messageId: 'config', data: { what } })
      }
    }

    return {
      ImportDeclaration(node) {
        if (!/(^|\/)env$/.test(node.source.value)) return
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'env') {
            envBindings.add(specifier.local.name)
          }
        }
      },
      MemberExpression(node) {
        if (isProcessEnv(node.object)) {
          const name = staticPropertyName(node)
          if (name && !DIRECT_ENV_VARS.has(name) && !name.startsWith('NEXT_PUBLIC_')) {
            report(node, `process.env.${name}`)
          }
          return
        }
        if (node.object.type === 'Identifier' && envBindings.has(node.object.name)) {
          report(node, `${node.object.name}.${staticPropertyName(node) ?? '[key]'}`)
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && SDK_OWNERS[node.callee.name]) {
          report(node, `new ${node.callee.name}()`)
        }
      },
    }
  },
}

const plugin = {
  rules: {
    'no-process-env': noProcessEnv,
    'no-sdk-client': noSdkClient,
    'no-import-time-config': noImportTimeConfig,
  },
}

export default plugin
