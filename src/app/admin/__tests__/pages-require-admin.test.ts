import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const adminRoot = path.join(process.cwd(), 'src/app/admin')

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return pages(entryPath)
    return entry.name === 'page.tsx' ? [entryPath] : []
  })
}

describe('admin pages', () => {
  it('each server page outside /admin/login awaits requireAdminSession itself', () => {
    const serverPages = pages(adminRoot).filter(
      (page) =>
        !page.startsWith(path.join(adminRoot, 'login')) &&
        !readFileSync(page, 'utf8').startsWith("'use client'")
    )

    expect(serverPages.length).toBeGreaterThanOrEqual(10)
    expect(
      serverPages.filter(
        (page) => !readFileSync(page, 'utf8').includes('await requireAdminSession()')
      )
    ).toEqual([])
  })
})
