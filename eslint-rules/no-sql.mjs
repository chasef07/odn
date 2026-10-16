const KEYWORD_STATEMENT =
  /^\s*(INSERT\s+INTO\s|UPDATE\s+\S+\s+SET\s|DELETE\s+FROM\s|CREATE\s+(TABLE|INDEX|UNIQUE|TYPE|SCHEMA|FUNCTION|EXTENSION|OR\s+REPLACE)\s|ALTER\s+(TABLE|TYPE)\s|DROP\s+(TABLE|INDEX|TYPE|SCHEMA|FUNCTION)\s|TRUNCATE\s+(TABLE\s+)?(ONLY\s+)?"?[A-Za-z_][A-Za-z0-9_.]*"?\s*(;|$|,|CASCADE|RESTART)|WITH\s+(RECURSIVE\s+)?\S+\s+AS\s*\()/
const SELECT_STATEMENT = /^\s*SELECT\s[\s\S]+\sFROM\s/

function statementText(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked ?? '').join(' ')
  }
  return null
}

const noSql = {
  meta: {
    type: 'problem',
    docs: { description: 'SQL text lives only in src/db' },
    schema: [],
    messages: {
      sql: 'SQL belongs in a named function of a src/db module. Call that function here; it owns the statement and the row shape.',
    },
  },
  create(context) {
    function check(node) {
      const text = statementText(node)
      if (text === null) return
      if (KEYWORD_STATEMENT.test(text) || SELECT_STATEMENT.test(text)) {
        context.report({ node, messageId: 'sql' })
      }
    }
    return { Literal: check, TemplateLiteral: check }
  },
}

const plugin = { rules: { 'no-sql': noSql } }

export default plugin
