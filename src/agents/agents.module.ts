import { Elysia } from 'elysia'
import type { Logger } from 'pino'
import type { IClock } from '../shared/application/ports/clock.port'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import { CreateAgentUseCase } from './application/usecases/create-agent.usecase'
import { CreateEvalDatasetUseCase } from './application/usecases/create-eval-dataset.usecase'
import { CreatePromptVersionUseCase } from './application/usecases/create-prompt-version.usecase'
import { DeleteAgentUseCase } from './application/usecases/delete-agent.usecase'
import { DeleteEvalDatasetUseCase } from './application/usecases/delete-eval-dataset.usecase'
import { GetAgentUseCase } from './application/usecases/get-agent.usecase'
import { GetEvalDatasetUseCase } from './application/usecases/get-eval-dataset.usecase'
import { GetLatestPromptVersionUseCase } from './application/usecases/get-latest-prompt-version.usecase'
import { GetPromptVersionUseCase } from './application/usecases/get-prompt-version.usecase'
import { ListAgentsUseCase } from './application/usecases/list-agents.usecase'
import { ListEvalDatasetsUseCase } from './application/usecases/list-eval-datasets.usecase'
import { ListPromptVersionsUseCase } from './application/usecases/list-prompt-versions.usecase'
import { UpdateAgentUseCase } from './application/usecases/update-agent.usecase'
import { DrizzleAgentRepository } from './infrastructure/repositories/drizzle-agent.repository'
import { DrizzleEvalDatasetRepository } from './infrastructure/repositories/drizzle-eval-dataset.repository'
import { DrizzlePromptVersionRepository } from './infrastructure/repositories/drizzle-prompt-version.repository'
import { agentController } from './presentation/controllers/agent.controller'
import { evalDatasetController } from './presentation/controllers/eval-dataset.controller'
import { promptVersionController } from './presentation/controllers/prompt-version.controller'

export interface AgentsModuleDeps {
  db: DrizzleDb
  logger?: Logger
  clock?: IClock
}

export function createAgentsModule(deps: AgentsModuleDeps) {
  const clock: IClock = deps.clock ?? { now: () => new Date() }

  const agentRepo = new DrizzleAgentRepository(deps.db)
  const promptVersionRepo = new DrizzlePromptVersionRepository(deps.db)
  const evalDatasetRepo = new DrizzleEvalDatasetRepository(deps.db)

  const createAgent = new CreateAgentUseCase(agentRepo, clock)
  const getAgent = new GetAgentUseCase(agentRepo)
  const listAgents = new ListAgentsUseCase(agentRepo)
  const updateAgent = new UpdateAgentUseCase(agentRepo, clock)
  const deleteAgent = new DeleteAgentUseCase(agentRepo)

  const createPromptVersion = new CreatePromptVersionUseCase(agentRepo, promptVersionRepo, clock)
  const getLatestPromptVersion = new GetLatestPromptVersionUseCase(agentRepo, promptVersionRepo)
  const getPromptVersion = new GetPromptVersionUseCase(agentRepo, promptVersionRepo)
  const listPromptVersions = new ListPromptVersionsUseCase(agentRepo, promptVersionRepo)

  const createEvalDataset = new CreateEvalDatasetUseCase(agentRepo, evalDatasetRepo, clock)
  const getEvalDataset = new GetEvalDatasetUseCase(agentRepo, evalDatasetRepo)
  const listEvalDatasets = new ListEvalDatasetsUseCase(agentRepo, evalDatasetRepo)
  const deleteEvalDataset = new DeleteEvalDatasetUseCase(agentRepo, evalDatasetRepo)

  return new Elysia({ name: 'rigging/agents' })
    .use(agentController({ createAgent, getAgent, listAgents, updateAgent, deleteAgent }))
    .use(
      promptVersionController({
        createPromptVersion,
        getLatestPromptVersion,
        getPromptVersion,
        listPromptVersions,
      }),
    )
    .use(
      evalDatasetController({
        createEvalDataset,
        getEvalDataset,
        listEvalDatasets,
        deleteEvalDataset,
      }),
    )
}
