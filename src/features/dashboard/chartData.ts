import { aggregateWeekly, roundTo, selectDays, type RangeDays } from '@/lib/health'
import type { DailyMetrics, HealthData, IsoDate } from '@/types/health'
import { formatShortDate } from './format'

// Flattens DailyMetrics into chart rows. At 90 days, bars become unreadable as
// 90 slivers, so rows are aggregated into weekly averages.

export const TREND_KEYS = [
	'steps',
	'activeMinutes',
	'deepH',
	'remH',
	'lightH',
	'sleepH',
	'rhr',
	'hrv',
	'systolic',
	'diastolic',
	'weight',
	'proteinG',
	'proteinKcal',
	'carbsKcal',
	'fatKcal',
] as const

export type TrendKey = (typeof TREND_KEYS)[number]

export type TrendRow = { date: IsoDate; label: string } & Record<TrendKey, number | null>

export interface TrendData {
	rows: TrendRow[]
	weekly: boolean
}

const hours = (min: number | undefined | null) => (min == null ? null : min / 60)

function toRow(d: DailyMetrics): TrendRow {
	return {
		date: d.date,
		label: formatShortDate(d.date),
		steps: d.steps,
		activeMinutes: d.activeMinutes,
		deepH: hours(d.sleep?.deepMinutes),
		remH: hours(d.sleep?.remMinutes),
		lightH: hours(d.sleep?.lightMinutes),
		sleepH: hours(d.sleep?.totalMinutes),
		rhr: d.restingHeartRate,
		hrv: d.hrvMs,
		systolic: d.bloodPressure?.systolic ?? null,
		diastolic: d.bloodPressure?.diastolic ?? null,
		weight: d.weightKg,
		proteinG: d.nutrition?.proteinG ?? null,
		proteinKcal: d.nutrition ? d.nutrition.proteinG * 4 : null,
		carbsKcal: d.nutrition ? d.nutrition.carbsG * 4 : null,
		fatKcal: d.nutrition ? d.nutrition.fatG * 9 : null,
	}
}

function roundRow(row: TrendRow): TrendRow {
	const out = { ...row }
	for (const key of TREND_KEYS) {
		const v = row[key]
		out[key] = v === null ? null : roundTo(v, key.endsWith('H') || key === 'weight' ? 1 : 0)
	}
	return out
}

export function buildTrendData(data: HealthData, range: RangeDays): TrendData {
	const daily = selectDays(data, range).map(toRow)
	if (range < 90) return { rows: daily.map(roundRow), weekly: false }
	const rows = aggregateWeekly(daily, TREND_KEYS).map((week) =>
		roundRow({
			date: week.weekStart,
			label: formatShortDate(week.weekStart),
			...week.values,
		}),
	)
	return { rows, weekly: true }
}

export function hasValues(rows: readonly TrendRow[], ...keys: TrendKey[]): boolean {
	return rows.some((row) => keys.some((key) => row[key] !== null))
}

/** Mean of a key over rows, ignoring nulls (for chart summaries). */
export function averageOf(rows: readonly TrendRow[], key: TrendKey): number | null {
	const values = rows.map((r) => r[key]).filter((v): v is number => v !== null)
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}
