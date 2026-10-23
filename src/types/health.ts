// Shared health-data contracts. Consumed by the dashboard (client), the
// summary builder, and the assistant agent (server). Change with care: all
// three depend on these shapes.

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string

export interface Persona {
	id: string
	name: string
	age: number
	sex: 'female' | 'male' | 'other'
	heightCm: number
	occupation: string
	location: string
	/** Self-reported context (e.g. "pre-hypertension flagged at last check-up"). */
	healthContext: string[]
	/** Why the user is using the app, in their own words. */
	motivation: string
}

export interface SleepRecord {
	totalMinutes: number
	deepMinutes: number
	remMinutes: number
	lightMinutes: number
	awakeMinutes: number
	/** Local bedtime, `HH:mm` (24h). */
	bedtime: string
}

export interface NutritionRecord {
	calories: number
	proteinG: number
	carbsG: number
	fatG: number
	waterMl: number
}

export interface BloodPressure {
	systolic: number
	diastolic: number
}

/** One day of tracked data. Nullable fields are not measured every day. */
export interface DailyMetrics {
	date: IsoDate
	steps: number
	activeMinutes: number
	caloriesBurned: number
	restingHeartRate: number
	hrvMs: number | null
	sleep: SleepRecord | null
	nutrition: NutritionRecord | null
	weightKg: number | null
	bloodPressure: BloodPressure | null
	/** 1 (low) to 5 (great), self-reported. */
	mood: 1 | 2 | 3 | 4 | 5 | null
}

export type ActivityType = 'run' | 'walk' | 'cycle' | 'strength' | 'yoga' | 'swim'

export interface Activity {
	id: string
	date: IsoDate
	type: ActivityType
	title: string
	durationMin: number
	distanceKm: number | null
	caloriesBurned: number
	avgHeartRate: number | null
}

/** Metrics the summary, goals, charts and agent tools can refer to. */
export type MetricKey =
	| 'steps'
	| 'activeMinutes'
	| 'sleepMinutes'
	| 'restingHeartRate'
	| 'hrvMs'
	| 'weightKg'
	| 'caloriesIn'
	| 'proteinG'
	| 'waterMl'
	| 'systolic'
	| 'diastolic'
	| 'mood'

export interface Goal {
	id: string
	metric: MetricKey
	label: string
	target: number
	unit: string
	/** `atLeast`: higher is better (steps). `atMost`: lower is better (weight, BP). */
	direction: 'atLeast' | 'atMost'
	/** How the current value is computed: 7-day average or latest reading. */
	basis: 'avg7' | 'latest'
	baseline: number
	deadline: IsoDate | null
}

export interface HealthData {
	persona: Persona
	/** Last day in the dataset; "today" from the user's point of view. */
	asOf: IsoDate
	days: DailyMetrics[]
	activities: Activity[]
	goals: Goal[]
}

// ---- Derived (computed by src/lib/health/summary.ts) ----

export type Trend = 'up' | 'down' | 'flat'

export interface MetricSummary {
	key: MetricKey
	label: string
	unit: string
	/** Most recent non-null reading. */
	latest: number | null
	latestDate: IsoDate | null
	avg7: number | null
	avg30: number | null
	avg90: number | null
	/** Last-30-day average vs the 30 days before it, in percent. */
	changePct30: number | null
	trend: Trend
	/** Whether `up` is good for this metric (false for RHR, weight, BP). */
	higherIsBetter: boolean
	/** Number of days with a reading in the dataset. */
	dataPoints: number
}

export interface GoalProgress {
	goalId: string
	metric: MetricKey
	label: string
	current: number | null
	target: number
	baseline: number
	unit: string
	/** 0–100, progress from baseline toward target. */
	progressPct: number
	status: 'achieved' | 'on-track' | 'behind' | 'no-data'
}

export interface Insight {
	id: string
	severity: 'positive' | 'info' | 'warning'
	title: string
	detail: string
	metric: MetricKey | null
}

export interface HealthSummary {
	asOf: IsoDate
	persona: Persona
	periodStart: IsoDate
	metrics: Record<MetricKey, MetricSummary>
	goals: GoalProgress[]
	/** Most recent activities, newest first. */
	recentActivities: Activity[]
	/** Activity counts and minutes over the last 7 and 30 days. */
	activityTotals: {
		last7: { sessions: number; minutes: number }
		last30: { sessions: number; minutes: number }
	}
	/** Deterministic, rule-based recommendations/observations. */
	insights: Insight[]
}
