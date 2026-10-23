import { FunctionTool } from '@google/adk'
import { z } from 'zod'
import type { HealthData, HealthSummary, MetricKey } from '../src/types/health.js'
import {
	ACTIVITY_TYPES,
	HISTORY_DAYS,
	METRIC_KEYS,
	METRIC_UNITS,
	readMetric,
	round,
	shiftIsoDate,
} from './metrics.js'

// Read-only tools the agent can call for detail that is not in the compact
// summary (day-by-day values, the activity log, goal definitions). The pure
// handlers below take `unknown` args, validate them, and return `{ error }`
// instead of throwing, so the model gets a useful message it can recover from.

const MAX_ACTIVITIES_LISTED = 30

export interface ToolError {
	error: string
}

export interface ToolSources {
	data: HealthData
	summary: HealthSummary
}

const daysSchema = z
	.number()
	.int()
	.min(HISTORY_DAYS.min)
	.max(HISTORY_DAYS.max)
	.optional()
	.describe(
		`How many days back from the latest date to include (${HISTORY_DAYS.min}-${HISTORY_DAYS.max}, default ${HISTORY_DAYS.default}).`,
	)

const metricHistoryArgs = z.object({
	metric: z.enum(METRIC_KEYS).describe('Which tracked metric to return.'),
	days: daysSchema,
})

const activitiesArgs = z.object({
	days: daysSchema,
	type: z.enum(ACTIVITY_TYPES).optional().describe('Only return activities of this type.'),
})

function describeIssues(error: z.ZodError): string {
	return error.issues
		.map((issue) => `${issue.path.join('.') || 'args'}: ${issue.message}`)
		.join('; ')
}

function windowStart(asOf: string, days: number): string {
	return shiftIsoDate(asOf, -(days - 1))
}

export interface MetricHistoryResult {
	metric: MetricKey
	unit: string
	from: string
	to: string
	daysInWindow: number
	daysWithData: number
	points: { date: string; value: number }[]
	stats: {
		min: number
		max: number
		avg: number
		first: number
		last: number
	} | null
}

export function getMetricHistory(args: unknown, data: HealthData): MetricHistoryResult | ToolError {
	const parsed = metricHistoryArgs.safeParse(args ?? {})
	if (!parsed.success) {
		return {
			error: `Invalid arguments (${describeIssues(parsed.error)}). Valid metrics: ${METRIC_KEYS.join(', ')}.`,
		}
	}
	const { metric } = parsed.data
	const days = parsed.data.days ?? HISTORY_DAYS.default
	const from = windowStart(data.asOf, days)
	const points: { date: string; value: number }[] = []
	for (const day of data.days) {
		if (day.date < from || day.date > data.asOf) continue
		const value = readMetric(day, metric)
		if (value !== null) points.push({ date: day.date, value: round(value) ?? value })
	}
	const values = points.map((p) => p.value)
	const stats =
		values.length === 0
			? null
			: {
					min: Math.min(...values),
					max: Math.max(...values),
					avg: round(values.reduce((sum, v) => sum + v, 0) / values.length) ?? 0,
					first: values[0],
					last: values[values.length - 1],
				}
	return {
		metric,
		unit: METRIC_UNITS[metric],
		from,
		to: data.asOf,
		daysInWindow: days,
		daysWithData: points.length,
		points,
		stats,
	}
}

export interface ActivitiesResult {
	from: string
	to: string
	type: string | null
	sessions: number
	totalMinutes: number
	totalDistanceKm: number
	byType: Record<string, { sessions: number; minutes: number }>
	/** Newest first, capped; `truncated` says whether more exist. */
	activities: {
		date: string
		type: string
		title: string
		durationMin: number
		distanceKm: number | null
		caloriesBurned: number
		avgHeartRate: number | null
	}[]
	truncated: boolean
}

export function getActivities(args: unknown, data: HealthData): ActivitiesResult | ToolError {
	const parsed = activitiesArgs.safeParse(args ?? {})
	if (!parsed.success) {
		return {
			error: `Invalid arguments (${describeIssues(parsed.error)}). Valid types: ${ACTIVITY_TYPES.join(', ')}.`,
		}
	}
	const days = parsed.data.days ?? HISTORY_DAYS.default
	const type = parsed.data.type ?? null
	const from = windowStart(data.asOf, days)
	const matching = data.activities
		.filter((a) => a.date >= from && a.date <= data.asOf && (type === null || a.type === type))
		.sort((a, b) => b.date.localeCompare(a.date))

	const byType: Record<string, { sessions: number; minutes: number }> = {}
	let totalMinutes = 0
	let totalDistanceKm = 0
	for (const a of matching) {
		const bucket = byType[a.type] ?? { sessions: 0, minutes: 0 }
		bucket.sessions += 1
		bucket.minutes += a.durationMin
		byType[a.type] = bucket
		totalMinutes += a.durationMin
		totalDistanceKm += a.distanceKm ?? 0
	}

	return {
		from,
		to: data.asOf,
		type,
		sessions: matching.length,
		totalMinutes,
		totalDistanceKm: round(totalDistanceKm) ?? 0,
		byType,
		activities: matching.slice(0, MAX_ACTIVITIES_LISTED).map((a) => ({
			date: a.date,
			type: a.type,
			title: a.title,
			durationMin: a.durationMin,
			distanceKm: a.distanceKm,
			caloriesBurned: a.caloriesBurned,
			avgHeartRate: a.avgHeartRate,
		})),
		truncated: matching.length > MAX_ACTIVITIES_LISTED,
	}
}

export interface GoalsResult {
	asOf: string
	goals: {
		id: string
		metric: MetricKey
		label: string
		unit: string
		direction: 'atLeast' | 'atMost'
		basis: 'avg7' | 'latest'
		baseline: number
		target: number
		current: number | null
		progressPct: number | null
		status: string
		deadline: string | null
	}[]
}

export function getGoals({ data, summary }: ToolSources): GoalsResult {
	return {
		asOf: data.asOf,
		goals: data.goals.map((goal) => {
			const progress = summary.goals.find((g) => g.goalId === goal.id)
			return {
				id: goal.id,
				metric: goal.metric,
				label: goal.label,
				unit: goal.unit,
				direction: goal.direction,
				basis: goal.basis,
				baseline: goal.baseline,
				target: goal.target,
				current: round(progress?.current ?? null),
				progressPct: round(progress?.progressPct ?? null, 0),
				status: progress?.status ?? 'no-data',
				deadline: goal.deadline,
			}
		}),
	}
}

/** ADK tool wrappers around the pure handlers. */
export function createHealthTools(sources: ToolSources): FunctionTool[] {
	const metricHistory = new FunctionTool({
		name: 'get_metric_history',
		description:
			'Returns dated daily values and min/max/avg for one tracked metric over the last N days. Use it for trends or day-level detail that the summary does not contain.',
		parameters: metricHistoryArgs,
		execute: (args) => getMetricHistory(args, sources.data),
	})
	const activities = new FunctionTool({
		name: 'get_activities',
		description:
			'Returns logged workouts (newest first) over the last N days, with totals per activity type. Optionally filter by type.',
		parameters: activitiesArgs,
		execute: (args) => getActivities(args, sources.data),
	})
	const goals = new FunctionTool({
		name: 'get_goals',
		description:
			'Returns every goal with its definition (target, direction, deadline) and current progress.',
		execute: () => getGoals(sources),
	})
	return [metricHistory, activities, goals] as FunctionTool[]
}
