const DIRECTIVE_PATTERNS = [
  /^\s*@ts-(expect-error|ignore|nocheck|check)(\s|$)/,
  /^\/\s*<reference\s/,
]

function isDirective(comment) {
  if (comment.type === 'Shebang') return true
  return DIRECTIVE_PATTERNS.some((pattern) => pattern.test(comment.value))
}

function isWhitespace(text) {
  return /^[ \t]*$/.test(text)
}

function removalRange(sourceCode, comment) {
  const text = sourceCode.text
  let [start, end] = comment.range

  const node = sourceCode.getNodeByRangeIndex(start)
  if (node && (node.type === 'JSXEmptyExpression' || node.type === 'JSXExpressionContainer')) {
    const container = node.type === 'JSXEmptyExpression' ? node.parent : node
    if (
      container?.type === 'JSXExpressionContainer' &&
      container.expression.type === 'JSXEmptyExpression'
    ) {
      ;[start, end] = container.range
    }
  }

  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const newline = text.indexOf('\n', end)
  const lineEnd = newline === -1 ? text.length : newline

  const before = text.slice(lineStart, start)
  const after = text.slice(end, lineEnd)

  if (isWhitespace(before) && isWhitespace(after)) {
    return [lineStart, newline === -1 ? text.length : newline + 1]
  }
  if (isWhitespace(after)) {
    return [start - (before.length - before.trimEnd().length), end]
  }
  return [start, end + (after.length - after.trimStart().length)]
}

const noComments = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow code comments other than tool directives' },
    fixable: 'code',
    schema: [],
    messages: { noComment: 'Code comments are not allowed.' },
  },
  create(context) {
    const sourceCode = context.sourceCode
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (isDirective(comment)) continue
          context.report({
            loc: comment.loc,
            messageId: 'noComment',
            fix: (fixer) => fixer.removeRange(removalRange(sourceCode, comment)),
          })
        }
      },
    }
  },
}

const plugin = {
  rules: { 'no-comments': noComments },
}

export default plugin
