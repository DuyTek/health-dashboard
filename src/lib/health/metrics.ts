import type { DailyMetrics, MetricKey } from '../../types/health'

export interface MetricMeta {
	label: string
	unit: string
	/** Whether a rising value is good news. */
	higherIsBetter: boolean
	/**
	 * Dead-band for `trend`, in percent. Changes smaller than this read as
	 * `flat`. Slow-moving metrics (weight, BP, RHR) get a tighter band.
	 */
	trendThresholdPct: number
	/** Decimal places used when rounding averages. */
	decimals: number
}

export const METRIC_KEYS: readonly MetricKey[] = [
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
]

export const METRIC_META: Record<MetricKey, MetricMeta> = {
	steps: { label: 'Steps', unit: 'steps', higherIsBetter: true, trendThresholdPct: 3, decimals: 0 },
	activeMinutes: {
		label: 'Active minutes',
		unit: 'min',
		higherIsBetter: true,
		trendThresholdPct: 3,
		decimals: 0,
	},
	sleepMinutes: {
		label: 'Sleep',
		unit: 'min',
		higherIsBetter: true,
		trendThresholdPct: 3,
		decimals: 0,
	},
	restingHeartRate: {
		label: 'Resting heart rate',
		unit: 'bpm',
		higherIsBetter: false,
		trendThresholdPct: 2,
		decimals: 1,
	},
	hrvMs: { label: 'HRV', unit: 'ms', higherIsBetter: true, trendThresholdPct: 3, decimals: 1 },
	weightKg: {
		label: 'Weight',
		unit: 'kg',
		higherIsBetter: false,
		trendThresholdPct: 0.5,
		decimals: 1,
	},
	caloriesIn: {
		label: 'Calories eaten',
		unit: 'kcal',
		// Persona is trying to lose weight, so a falling intake is good news.
		higherIsBetter: false,
		trendThresholdPct: 3,
		decimals: 0,
	},
	proteinG: { label: 'Protein', unit: 'g', higherIsBetter: true, trendThresholdPct: 3, decimals: 0 },
	waterMl: { label: 'Water', unit: 'ml', higherIsBetter: true, trendThresholdPct: 3, decimals: 0 },
	systolic: {
		label: 'Systolic BP',
		unit: 'mmHg',
		higherIsBetter: false,
		trendThresholdPct: 1.5,
		decimals: 0,
	},
	diastolic: {
		label: 'Diastolic BP',
		unit: 'mmHg',
		higherIsBetter: false,
		trendThresholdPct: 1.5,
		decimals: 0,
	},
	mood: { label: 'Mood', unit: '/5', higherIsBetter: true, trendThresholdPct: 3, decimals: 1 },
}

/** The value of `metric` on one day, or null when it wasn't measured. */
export function getMetricValue(day: DailyMetrics, metric: MetricKey): number | null {
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

export function roundTo(value: number, decimals: number): number {
	const f = 10 ** decimals
	return Math.round(value * f) / f
}

export function mean(values: readonly number[]): number | null {
	if (values.length === 0) return null
	return values.reduce((a, b) => a + b, 0) / values.length
}
