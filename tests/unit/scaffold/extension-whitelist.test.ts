import { describe, expect, test } from 'bun:test'
import { isTextFile } from '../../../packages/create-rigging/lib/helpers.js'

describe('isTextFile — text extensions (should return true)', () => {
  const textExtensions = ['.ts', '.tsx', '.js', '.json', '.md', '.yml', '.yaml', '.toml', '.sql', '.txt']

  for (const ext of textExtensions) {
    test(`isTextFile("src/foo${ext}") → true`, () => {
      expect(isTextFile(`src/foo${ext}`)).toBe(true)
    })
  }
})

describe('isTextFile — binary/unknown extensions (should return false)', () => {
  const binaryExtensions = ['.lock', '.png', '.woff2', '.ico', '.pdf', '.zip', '.gz']

  for (const ext of binaryExtensions) {
    test(`isTextFile("file${ext}") → false`, () => {
      expect(isTextFile(`file${ext}`)).toBe(false)
    })
  }

  test('isTextFile("bun.lock") → false (lock file copied verbatim per D-11)', () => {
    expect(isTextFile('bun.lock')).toBe(false)
  })
})

describe('isTextFile — .env* files (should return true)', () => {
  const envFiles = ['.env.example', '.env.local', '.env.test', '.env']

  for (const name of envFiles) {
    test(`isTextFile("${name}") → true`, () => {
      expect(isTextFile(name)).toBe(true)
    })
  }
})
