// Use case: compose HealthStatus by asking the DB probe port for current state.
// NOTE: does NOT catch probe rejections — controller owns 503-on-probe-reject (D-03).
//       This keeps the use case thin; errors propagate up the layer.

import { type HealthStatus, makeHealthStatus } from '../../domain'
import type { IDbHealthProbe } from '../ports/db-health-probe.port'

export interface IClock {
  now(): Date
}

export class CheckHealthUseCase {
  constructor(
    private readonly probe: IDbHealthProbe,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<HealthStatus> {
    const dbState = await this.probe.probe() // may reject — controller catches
    return makeHealthStatus({ db: dbState, checkedAt: this.clock.now() })
  }
}
