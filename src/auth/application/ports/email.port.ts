export interface IEmailPort {
  send(params: { to: string; subject: string; body: string }): Promise<void>
}
