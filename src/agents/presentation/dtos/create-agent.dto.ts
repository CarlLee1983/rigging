import { type Static, Type } from '@sinclair/typebox'

export const CreateAgentBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 128 }),
})

export type CreateAgentBody = Static<typeof CreateAgentBodySchema>
