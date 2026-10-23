import type { DailyMetrics, HealthData, IsoDate, MetricKey } from '../../types/health'
import { addDays, inWindow, startOfWeek } from './dates'
import { getMetricValue, mean } from './metrics'

// Pure selectors for charts and agent tools.

export type RangeDays = 7 | 30 | 90

export interface SeriesPoint {
	date: IsoDate
	value: number | null
}

/** Days in the `days`-long window ending at `data.asOf`, oldest first. */
export function selectDays(data: HealthData, days: number): DailyMetrics[] {
	return data.days
		.filter((d) => inWindow(d.date, data.asOf, days))
		.toSorted((a, b) => a.date.localeCompare(b.date))
}

/** One point per day in the window (null where the metric wasn't measured). */
export function selectSeries(data: HealthData, metric: MetricKey, days: number): SeriesPoint[] {
	return selectDays(data, days).map((d) => ({ date: d.date, value: getMetricValue(d, metric) }))
}

/** Values in a window ending at `end`, skipping missing readings. */
export function valuesInWindow(
	days: readonly DailyMetrics[],
	metric: MetricKey,
	end: IsoDate,
	length: number,
): number[] {
	const out: number[] = []
	for (const d of days) {
		if (!inWindow(d.date, end, length)) continue
		const v = getMetricValue(d, metric)
		if (v !== null) out.push(v)
	}
	return out
}

export interface WeeklyRow<K extends string> {
	/** Monday of the week. */
	weekStart: IsoDate
	/** Number of days that contributed. */
	days: number
	values: Record<K, number | null>
}

/**
 * Group daily rows by ISO week (Mon–Sun) and average each numeric field,
 * ignoring nulls. Used to keep 90-day bar charts readable.
 */
export function aggregateWeekly<K extends string>(
	rows: readonly ({ date: IsoDate } & Record<K, number | null>)[],
	keys: readonly K[],
): WeeklyRow<K>[] {
	const groups = new Map<IsoDate, ({ date: IsoDate } & Record<K, number | null>)[]>()
	for (const row of rows) {
		const week = startOfWeek(row.date)
		const list = groups.get(week) ?? []
		list.push(row)
		groups.set(week, list)
	}
	return [...groups.entries()]
		.toSorted(([a], [b]) => a.localeCompare(b))
		.map(([weekStart, list]) => {
			const values = {} as Record<K, number | null>
			for (const key of keys) {
				const present = list.map((r) => r[key] as number | null).filter((v): v is number => v !== null)
				values[key] = mean(present)
			}
			return { weekStart, days: list.length, values }
		})
}

/** Last day of the week starting `weekStart`. */
export function endOfWeek(weekStart: IsoDate): IsoDate {
	return addDays(weekStart, 6)
}
