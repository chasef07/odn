const WRAPPER = 'adminAction'
const WRAPPER_SOURCE = '@/lib/admin-session'

function isUseServerFile(program) {
  return program.body.some((node) => node.directive === 'use server')
}

function exportedName(node) {
  const decl = node.declaration
  if (decl?.id?.name) return decl.id.name
  if (decl?.declarations) return decl.declarations.map((d) => d.id.name ?? '?').join(', ')
  return node.specifiers?.map((s) => s.exported.name ?? s.exported.value).join(', ') ?? 'default'
}

function isTypeOnly(node) {
  if (node.exportKind === 'type') return true
  const decl = node.declaration
  if (decl?.type === 'TSTypeAliasDeclaration' || decl?.type === 'TSInterfaceDeclaration')
    return true
  return (
    !decl && node.specifiers?.length > 0 && node.specifiers.every((s) => s.exportKind === 'type')
  )
}

const serverAction = {
  meta: {
    type: 'problem',
    docs: { description: 'Require every admin server action to be built with adminAction' },
    schema: [],
    messages: {
      unwrapped:
        "Admin server action '{{name}}' is a public POST endpoint, and page or layout gates do not run for it. Declare it as `export const {{name}} = adminAction(async (admin, ...args) => { ... })` with adminAction imported from '@/lib/admin-session'. Move a shared helper to a file without 'use server'.",
    },
  },
  create(context) {
    return {
      Program(program) {
        if (!isUseServerFile(program)) return
        const wrapperNames = new Set()
        for (const node of program.body)
          if (node.type === 'ImportDeclaration' && node.source.value === WRAPPER_SOURCE)
            for (const s of node.specifiers)
              if (s.type === 'ImportSpecifier' && s.imported.name === WRAPPER)
                wrapperNames.add(s.local.name)

        const isWrapped = (decl) =>
          decl?.type === 'VariableDeclaration' &&
          decl.declarations.every(
            (d) =>
              d.init?.type === 'CallExpression' &&
              d.init.callee.type === 'Identifier' &&
              wrapperNames.has(d.init.callee.name)
          )

        for (const node of program.body) {
          if (
            node.type !== 'ExportNamedDeclaration' &&
            node.type !== 'ExportDefaultDeclaration' &&
            node.type !== 'ExportAllDeclaration'
          )
            continue
          if (node.type !== 'ExportDefaultDeclaration' && isTypeOnly(node)) continue
          if (node.type === 'ExportNamedDeclaration' && isWrapped(node.declaration)) continue
          context.report({
            node,
            messageId: 'unwrapped',
            data: { name: node.type === 'ExportAllDeclaration' ? '*' : exportedName(node) },
          })
        }
      },
    }
  },
}

const plugin = {
  rules: { 'server-action': serverAction },
}

export default plugin
