import type { Logger } from 'pino'
import type { IEmailPort } from '../../application/ports/email.port'

export class ConsoleEmailAdapter implements IEmailPort {
  constructor(private readonly logger: Logger) {}

  async send(params: { to: string; subject: string; body: string }): Promise<void> {
    this.logger.info({ to: params.to, subject: params.subject }, `📧 CLICK THIS: ${params.body}`)
  }
}
