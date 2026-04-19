import { type Static, Type } from '@sinclair/typebox'

// D-04: EvalCase shape frozen for v1. ADR 0017 supersedes any change.
export const EvalCaseSchema = Type.Object({
  input: Type.String(),
  expectedOutput: Type.String(),
})

export const CreateEvalDatasetBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 128 }),
  cases: Type.Array(EvalCaseSchema, { minItems: 1, maxItems: 1000 }),
})

export type EvalCaseBody = Static<typeof EvalCaseSchema>
export type CreateEvalDatasetBody = Static<typeof CreateEvalDatasetBodySchema>
