// Port (interface) — application layer defines what it needs; infrastructure implements.
// Returns 'up' on success, 'down' if the underlying driver reports an error that the adapter chose to handle.
// The port contract ALLOWS a rejection for unexpected errors — the use case propagates it,
// and the controller (Task 3) catches it to produce 503. The Drizzle adapter (Task 2) never rejects
// in practice — it maps all errors to 'down' — but the port stays permissive so future adapters
// may reject without breaking the contract.

export type DbProbeResult = 'up' | 'down'

export interface IDbHealthProbe {
  probe(): Promise<DbProbeResult>
}
