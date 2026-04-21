import { Resend } from 'resend'
import type { Logger } from 'pino'
import type { IEmailPort } from '../../application/ports/email.port'

export class ResendEmailAdapter implements IEmailPort {
  private readonly client: Resend

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly logger: Logger,
  ) {
    this.client = new Resend(apiKey)
  }

  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.body,
    })

    if (error) {
      this.logger.error({ to: params.to, subject: params.subject, error }, 'ResendEmailAdapter: send failed')
      throw new Error(`Failed to send email via Resend: ${error.message}`)
    }

    this.logger.info({ to: params.to, subject: params.subject, id: data?.id }, 'ResendEmailAdapter: email sent')
  }
}
