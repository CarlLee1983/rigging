// Public domain barrel for the `health` feature.
// Consumers (application, presentation) MUST import from this file, never from domain/internal/.

export type { DbState, HealthStatus } from './internal/health-status'
export { makeHealthStatus } from './internal/health-status'
