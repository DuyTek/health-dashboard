import type { HealthData } from '../types/health'
import { generateHealthData } from './generate'

// Public entry point for the fictional dataset. Isomorphic and deterministic:
// the dashboard and the assistant's server tools see exactly the same data.

let cached: HealthData | null = null

/** The persona's 90-day dataset (generated once per process, then memoized). */
export function getHealthData(): HealthData {
	cached ??= generateHealthData()
	return cached
}

export { generateHealthData, DEFAULT_SEED, type GenerateOptions } from './generate'
export { AS_OF, DATASET_DAYS, GOALS, PERSONA, ROUTINE_START } from './persona'
