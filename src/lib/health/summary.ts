import type {
	Activity,
	DailyMetrics,
	Goal,
	GoalProgress,
	HealthData,
	HealthSummary,
	IsoDate,
	MetricKey,
	MetricSummary,
	Trend,
} from '../../types/health.js'
import { addDays, inWindow } from './dates.js'
import { buildInsights } from './insights.js'
import { getMetricValue, mean, METRIC_KEYS, METRIC_META, roundTo } from './metrics.js'
import { valuesInWindow } from './series.js'

// Pure: HealthData in, HealthSummary out. Shared by the dashboard and the
// assistant's system prompt, so both always quote the same numbers.

export const RECENT_ACTIVITY_LIMIT = 10

/** Percent change from `previous` to `current`; null when either is missing or previous is 0. */
export function percentChange(current: number | null, previous: number | null): number | null {
	if (current === null || previous === null || previous === 0) return null
	return ((current - previous) / previous) * 100
}

/** `up`/`down` only when the change clears the dead-band; otherwise `flat`. */
export function trendFromChange(changePct: number | null, thresholdPct: number): Trend {
	if (changePct === null || Math.abs(changePct) < thresholdPct) return 'flat'
	return changePct > 0 ? 'up' : 'down'
}

export function summarizeMetric(
	days: readonly DailyMetrics[],
	metric: MetricKey,
	asOf: IsoDate,
): MetricSummary {
	const meta = METRIC_META[metric]
	const avg = (length: number, end: IsoDate = asOf) => {
		const m = mean(valuesInWindow(days, metric, end, length))
		return m === null ? null : roundTo(m, meta.decimals)
	}

	let latest: number | null = null
	let latestDate: IsoDate | null = null
	let dataPoints = 0
	for (const day of days) {
		if (day.date > asOf) continue
		const value = getMetricValue(day, metric)
		if (value === null) continue
		dataPoints++
		if (latestDate === null || day.date > latestDate) {
			latest = value
			latestDate = day.date
		}
	}

	const last30 = mean(valuesInWindow(days, metric, asOf, 30))
	const prior30 = mean(valuesInWindow(days, metric, addDays(asOf, -30), 30))
	const rawChange = percentChange(last30, prior30)
	const changePct30 = rawChange === null ? null : roundTo(rawChange, 1)

	return {
		key: metric,
		label: meta.label,
		unit: meta.unit,
		latest,
		latestDate,
		avg7: avg(7),
		avg30: avg(30),
		avg90: avg(90),
		changePct30,
		trend: trendFromChange(changePct30, meta.trendThresholdPct),
		higherIsBetter: meta.higherIsBetter,
		dataPoints,
	}
}

function meetsTarget(goal: Goal, value: number): boolean {
	return goal.direction === 'atLeast' ? value >= goal.target : value <= goal.target
}

/**
 * Progress from baseline toward target, 0–100.
 * Status: `achieved` when the current value meets the target; `on-track` when
 * at least 70% of the way there or the 30-day trend is moving toward the
 * target; `behind` otherwise; `no-data` when there is no current value.
 */
export function computeGoalProgress(goal: Goal, metric: MetricSummary): GoalProgress {
	const current = goal.basis === 'avg7' ? metric.avg7 : metric.latest
	const base = {
		goalId: goal.id,
		metric: goal.metric,
		label: goal.label,
		current,
		target: goal.target,
		baseline: goal.baseline,
		unit: goal.unit,
	}
	if (current === null) return { ...base, progressPct: 0, status: 'no-data' }

	const span = goal.target - goal.baseline
	const raw =
		span === 0 ? (meetsTarget(goal, current) ? 100 : 0) : ((current - goal.baseline) / span) * 100
	const progressPct = Math.round(Math.min(100, Math.max(0, raw)))

	if (meetsTarget(goal, current)) return { ...base, progressPct: 100, status: 'achieved' }

	const towardTarget = goal.direction === 'atLeast' ? 'up' : 'down'
	const onTrack = progressPct >= 70 || metric.trend === towardTarget
	return { ...base, progressPct, status: onTrack ? 'on-track' : 'behind' }
}

function activityWindow(activities: readonly Activity[], asOf: IsoDate, length: number) {
	const inRange = activities.filter((a) => inWindow(a.date, asOf, length))
	return {
		sessions: inRange.length,
		minutes: inRange.reduce((sum, a) => sum + a.durationMin, 0),
	}
}

export function buildHealthSummary(data: HealthData): HealthSummary {
	const { asOf } = data
	const days = data.days.filter((d) => d.date <= asOf)

	const metrics = {} as Record<MetricKey, MetricSummary>
	for (const key of METRIC_KEYS) metrics[key] = summarizeMetric(days, key, asOf)

	const goals = data.goals.map((goal) => computeGoalProgress(goal, metrics[goal.metric]))

	const recentActivities = data.activities
		.filter((a) => a.date <= asOf)
		.toSorted((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
		.slice(0, RECENT_ACTIVITY_LIMIT)

	const activityTotals = {
		last7: activityWindow(data.activities, asOf, 7),
		last30: activityWindow(data.activities, asOf, 30),
	}

	const periodStart = days.reduce<IsoDate>((min, d) => (d.date < min ? d.date : min), asOf)

	return {
		asOf,
		persona: data.persona,
		periodStart,
		metrics,
		goals,
		recentActivities,
		activityTotals,
		insights: buildInsights({ days, asOf, metrics, goals, activityTotals, goalDefs: data.goals }),
	}
}
