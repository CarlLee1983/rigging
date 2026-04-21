import { describe, expect, mock, test } from 'bun:test'

const mockEmailsSend = mock(async () => ({
  data: { id: 'test-id-123' },
  error: null,
}))

mock.module('resend', () => ({
  Resend: class {
    emails = { send: mockEmailsSend }
  },
}))

const { ResendEmailAdapter } = await import(
  '../../../../src/auth/infrastructure/email/resend-email.adapter'
)

function makeLogger() {
  const infoCalls: Array<[unknown, string]> = []
  const errorCalls: Array<[unknown, string]> = []
  const logger = {
    info: (meta: unknown, message: string) => {
      infoCalls.push([meta, message])
    },
    error: (meta: unknown, message: string) => {
      errorCalls.push([meta, message])
    },
  } as never
  return { logger, infoCalls, errorCalls }
}

const FROM = 'noreply@example.com'
const API_KEY = 'test-api-key'

describe('ResendEmailAdapter', () => {
  test('resolves and calls logger.info on successful send', async () => {
    mockEmailsSend.mockImplementation(async () => ({
      data: { id: 'msg-abc-123' },
      error: null,
    }))

    const { logger, infoCalls } = makeLogger()
    const adapter = new ResendEmailAdapter(API_KEY, FROM, logger)

    await expect(
      adapter.send({
        to: 'alice@example.com',
        subject: 'Verify your email',
        body: 'https://example.com/verify?token=abc',
      }),
    ).resolves.toBeUndefined()

    expect(infoCalls).toHaveLength(1)
    const [meta] = infoCalls[0] ?? [{}]
    expect((meta as Record<string, unknown>).to).toBe('alice@example.com')
    expect((meta as Record<string, unknown>).subject).toBe('Verify your email')
    expect((meta as Record<string, unknown>).id).toBe('msg-abc-123')
  })

  test('passes correct arguments to emails.send', async () => {
    mockEmailsSend.mockImplementation(async () => ({
      data: { id: 'id-123' },
      error: null,
    }))

    const { logger } = makeLogger()
    const adapter = new ResendEmailAdapter(API_KEY, FROM, logger)

    await adapter.send({
      to: 'alice@example.com',
      subject: 'Verify your email',
      body: 'https://example.com/verify?token=abc',
    })

    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: FROM,
      to: 'alice@example.com',
      subject: 'Verify your email',
      text: 'https://example.com/verify?token=abc',
    })
  })

  test('throws Error and calls logger.error when Resend returns error', async () => {
    mockEmailsSend.mockImplementation(async () => ({
      data: null,
      error: { message: 'Invalid API key', name: 'validation_error' },
    }))

    const { logger, errorCalls } = makeLogger()
    const adapter = new ResendEmailAdapter(API_KEY, FROM, logger)

    await expect(
      adapter.send({
        to: 'alice@example.com',
        subject: 'Verify your email',
        body: 'https://example.com/verify',
      }),
    ).rejects.toThrow('Failed to send email via Resend')

    expect(errorCalls).toHaveLength(1)
  })
})
