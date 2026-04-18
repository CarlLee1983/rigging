import { loadConfig } from './bootstrap/config'

const config = loadConfig()

console.log('[rigging] P1 foundation ready.')
console.log(`[rigging] env loaded: NODE_ENV=${config.NODE_ENV}, PORT=${config.PORT}`)
console.log('[rigging] Next: Phase 2 will mount the Elysia root app.')
