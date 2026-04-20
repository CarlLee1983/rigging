import { describe, expect, test } from 'bun:test'
import {
  substituteProjectName,
  toTitleCase,
} from '../../../packages/create-rigging/lib/helpers.js'

describe('toTitleCase', () => {
  const cases = [
    ['rigging', 'Rigging'],
    ['my-app', 'My-app'],
    ['hello', 'Hello'],
    ['', ''],
  ] as const

  for (const [input, expected] of cases) {
    test(`toTitleCase("${input}") → "${expected}"`, () => {
      expect(toTitleCase(input)).toBe(expected)
    })
  }
})

describe('substituteProjectName', () => {
  const cases: [string, string, string][] = [
    ['"name": "rigging"', 'my-app', '"name": "my-app"'],
    ['container_name: rigging-postgres', 'my-app', 'container_name: my-app-postgres'],
    ['new Elysia({ name: "rigging/app" })', 'my-app', 'new Elysia({ name: "my-app/app" })'],
    [
      'DATABASE_URL=postgresql://rigging:rigging_dev_password@localhost:5432/rigging',
      'my-app',
      'DATABASE_URL=postgresql://my-app:my-app_dev_password@localhost:5432/my-app',
    ],
    ['title: Rigging API', 'my-app', 'title: My-app API'],
    ['Rigging is great and rigging works', 'my-app', 'My-app is great and my-app works'],
    ['No match here', 'my-app', 'No match here'],
  ]

  for (const [input, projectName, expected] of cases) {
    test(`substituteProjectName: "${input.slice(0, 40)}"`, () => {
      expect(substituteProjectName(input, projectName)).toBe(expected)
    })
  }
})
