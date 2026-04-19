import { describe, expect, test } from 'bun:test'
import { ConsoleEmailAdapter } from '../../../../src/auth/infrastructure/email/console-email.adapter'

describe('ConsoleEmailAdapter', () => {
  test('logs a teaching-UX line and resolves', async () => {
    const infoCalls: Array<[unknown, string]> = []
    const logger = {
      info: (meta: unknown, message: string) => {
        infoCalls.push([meta, message])
      },
    } as never

    const adapter = new ConsoleEmailAdapter(logger)
    await expect(
      adapter.send({
        to: 'alice@example.com',
        subject: 'Verify your email',
        body: 'https://example.com',
      }),
    ).resolves.toBeUndefined()

    expect(infoCalls).toHaveLength(1)
    expect(infoCalls[0]?.[1]).toContain('📧 CLICK THIS:')
    expect(infoCalls[0]?.[1]).toContain('https://example.com')
  })
})
