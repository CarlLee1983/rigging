import { type Static, Type } from '@sinclair/typebox'

export const UpdateAgentBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 128 }),
})

export type UpdateAgentBody = Static<typeof UpdateAgentBodySchema>
