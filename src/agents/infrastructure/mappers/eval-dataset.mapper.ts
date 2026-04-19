import type { AgentId, EvalCase, EvalDataset, EvalDatasetId } from '../../domain'

export type EvalDatasetDbRow = {
  id: string
  agentId: string
  name: string
  cases: unknown
  createdAt: Date
}

function parseCases(raw: unknown): EvalCase[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (c): c is EvalCase =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Record<string, unknown>).input === 'string' &&
      typeof (c as Record<string, unknown>).expectedOutput === 'string',
  )
}

export const EvalDatasetMapper = {
  toDomain(row: EvalDatasetDbRow): EvalDataset {
    return {
      id: row.id as EvalDatasetId,
      agentId: row.agentId as AgentId,
      name: row.name,
      cases: parseCases(row.cases),
      createdAt: row.createdAt,
    }
  },
}
