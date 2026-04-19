import { DomainError } from '../../shared/kernel/errors'

// D-06: thrown only after retry-3 exhaustion during concurrent PromptVersion writes.
// Kept agents-local (NOT in shared kernel) per 04-PATTERNS §5 rationale.
export class PromptVersionConflictError extends DomainError {
  readonly code = 'PROMPT_VERSION_CONFLICT'
  readonly httpStatus = 500
}
