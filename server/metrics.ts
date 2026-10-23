import type { ActivityType, DailyMetrics, MetricKey } from '../src/types/health.js'

// Runtime lists of the shared union types. `src/types` is type-only, so the
// server keeps its own arrays and the checks below fail to compile if a key is
// added to (or removed from) the contract without updating them.

export const METRIC_KEYS = [
	'steps',
	'activeMinutes',
	'sleepMinutes',
	'restingHeartRate',
	'hrvMs',
	'weightKg',
	'caloriesIn',
	'proteinG',
	'waterMl',
	'systolic',
	'diastolic',
	'mood',
] as const satisfies readonly MetricKey[]

export const ACTIVITY_TYPES = [
	'run',
	'walk',
	'cycle',
	'strength',
	'yoga',
	'swim',
] as const satisfies readonly ActivityType[]

type Exhaustive<T extends never> = T
export type MissingMetricKeys = Exhaustive<Exclude<MetricKey, (typeof METRIC_KEYS)[number]>>
export type MissingActivityTypes = Exhaustive<
	Exclude<ActivityType, (typeof ACTIVITY_TYPES)[number]>
>

/** Window (in days) the history tools accept. */
export const HISTORY_DAYS = { min: 7, max: 90, default: 30 } as const

/** Values the model may list in `<meta>.citedMetrics`. */
export const CITABLE_SOURCES: readonly string[] = [...METRIC_KEYS, 'activities', 'goals']

export const METRIC_UNITS: Record<MetricKey, string> = {
	steps: 'steps',
	activeMinutes: 'min',
	sleepMinutes: 'min',
	restingHeartRate: 'bpm',
	hrvMs: 'ms',
	weightKg: 'kg',
	caloriesIn: 'kcal',
	proteinG: 'g',
	waterMl: 'ml',
	systolic: 'mmHg',
	diastolic: 'mmHg',
	mood: 'score 1-5',
}

/** Reads one metric from a day of data; `null` when it was not measured. */
export function readMetric(day: DailyMetrics, metric: MetricKey): number | null {
	switch (metric) {
		case 'steps':
			return day.steps
		case 'activeMinutes':
			return day.activeMinutes
		case 'sleepMinutes':
			return day.sleep?.totalMinutes ?? null
		case 'restingHeartRate':
			return day.restingHeartRate
		case 'hrvMs':
			return day.hrvMs
		case 'weightKg':
			return day.weightKg
		case 'caloriesIn':
			return day.nutrition?.calories ?? null
		case 'proteinG':
			return day.nutrition?.proteinG ?? null
		case 'waterMl':
			return day.nutrition?.waterMl ?? null
		case 'systolic':
			return day.bloodPressure?.systolic ?? null
		case 'diastolic':
			return day.bloodPressure?.diastolic ?? null
		case 'mood':
			return day.mood
	}
}

/** Rounds to at most `digits` decimals; keeps `null` as is. */
export function round(value: number | null, digits = 1): number | null {
	if (value === null || !Number.isFinite(value)) return null
	const factor = 10 ** digits
	return Math.round(value * factor) / factor
}

/** `YYYY-MM-DD` minus `days` calendar days (UTC arithmetic, no time zones). */
export function shiftIsoDate(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`)
	date.setUTCDate(date.getUTCDate() + days)
	return date.toISOString().slice(0, 10)
}
