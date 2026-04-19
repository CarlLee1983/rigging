import { type Static, Type } from '@sinclair/typebox'

export const CreatePromptVersionBodySchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 65536 }),
})

export type CreatePromptVersionBody = Static<typeof CreatePromptVersionBodySchema>
