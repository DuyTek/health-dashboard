import type {
	DailyMetrics,
	Goal,
	GoalProgress,
	HealthSummary,
	Insight,
	IsoDate,
	MetricKey,
	MetricSummary,
} from '../../types/health'
import { daysBetween, inWindow } from './dates'
import { mean } from './metrics'

// Deterministic, rule-based observations. No LLM involved: the same data always
// produces the same insights, and every number in them is traceable.

export const SLEEP_TARGET_MIN = 420 // 7 h, the adult minimum most guidelines cite
export const WEEKLY_ACTIVE_MIN_GUIDELINE = 150
export const WATER_TARGET_ML = 2000
export const STEPS_CHANGE_NOTABLE_PCT = 10
export const STALE_AFTER_DAYS = 4

export interface InsightInput {
	days: readonly DailyMetrics[]
	asOf: IsoDate
	metrics: Record<MetricKey, MetricSummary>
	goals: readonly GoalProgress[]
	goalDefs: readonly Goal[]
	activityTotals: HealthSummary['activityTotals']
}

export function formatDuration(minutes: number): string {
	const m = Math.round(minutes)
	const h = Math.floor(m / 60)
	const rest = m % 60
	if (h === 0) return `${rest} min`
	return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

const fmt = (n: number, decimals = 0) =>
	n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** Bedtimes before noon are after midnight (late). */
function isLateBedtime(bedtime: string): boolean {
	return Number(bedtime.slice(0, 2)) < 12
}

function sleepInsights(input: InsightInput): Insight[] {
	const out: Insight[] = []
	const sleep = input.metrics.sleepMinutes
	if (sleep.avg7 !== null) {
		if (sleep.avg7 < SLEEP_TARGET_MIN) {
			out.push({
				id: 'sleep-short',
				severity: 'warning',
				title: `Sleep is averaging ${formatDuration(sleep.avg7)} this week`,
				detail: `That's under the 7 hours most adults need. A consistent, earlier bedtime is the most direct lever.`,
				metric: 'sleepMinutes',
			})
		} else {
			out.push({
				id: 'sleep-good',
				severity: 'positive',
				title: `Sleep is averaging ${formatDuration(sleep.avg7)} this week`,
				detail: 'You are meeting the 7-hour minimum. Keep your bedtime consistent.',
				metric: 'sleepMinutes',
			})
		}
	}

	// Late bedtimes vs on-time bedtimes over the last 30 days.
	const late: number[] = []
	const early: number[] = []
	for (const d of input.days) {
		if (!d.sleep || !inWindow(d.date, input.asOf, 30)) continue
		;(isLateBedtime(d.sleep.bedtime) ? late : early).push(d.sleep.totalMinutes)
	}
	const lateAvg = mean(late)
	const earlyAvg = mean(early)
	if (lateAvg !== null && earlyAvg !== null && late.length >= 3 && early.length >= 3) {
		const gap = earlyAvg - lateAvg
		if (gap >= 20) {
			out.push({
				id: 'sleep-late-bedtime',
				severity: 'info',
				title: `Nights after midnight cost you ${formatDuration(gap)} of sleep`,
				detail: `In the last 30 days you went to bed after midnight ${late.length} times and slept ${formatDuration(lateAvg)} on those nights, vs ${formatDuration(earlyAvg)} otherwise.`,
				metric: 'sleepMinutes',
			})
		}
	}
	return out
}

function activityInsights(input: InsightInput): Insight[] {
	const out: Insight[] = []
	const steps = input.metrics.steps
	if (steps.changePct30 !== null && steps.avg30 !== null) {
		if (steps.changePct30 >= STEPS_CHANGE_NOTABLE_PCT) {
			out.push({
				id: 'steps-up',
				severity: 'positive',
				title: `Steps are up ${fmt(steps.changePct30)}% over the last 30 days`,
				detail: `You're averaging ${fmt(steps.avg30)} steps a day compared with the 30 days before. The walking routine is working.`,
				metric: 'steps',
			})
		} else if (steps.changePct30 <= -STEPS_CHANGE_NOTABLE_PCT) {
			out.push({
				id: 'steps-down',
				severity: 'warning',
				title: `Steps are down ${fmt(Math.abs(steps.changePct30))}% over the last 30 days`,
				detail: `You're averaging ${fmt(steps.avg30)} steps a day. A short walk after lunch is an easy way back.`,
				metric: 'steps',
			})
		}
	}

	const weekDays = input.days.filter((d) => inWindow(d.date, input.asOf, 7))
	if (weekDays.length > 0) {
		const weekActive = weekDays.reduce((sum, d) => sum + d.activeMinutes, 0)
		out.push(
			weekActive >= WEEKLY_ACTIVE_MIN_GUIDELINE
				? {
						id: 'active-guideline',
						severity: 'positive',
						title: `${fmt(weekActive)} active minutes in the last 7 days`,
						detail: `That clears the ${WEEKLY_ACTIVE_MIN_GUIDELINE}-minute weekly guideline for moderate activity.`,
						metric: 'activeMinutes',
					}
				: {
						id: 'active-guideline',
						severity: 'info',
						title: `${fmt(weekActive)} active minutes in the last 7 days`,
						detail: `The guideline is ${WEEKLY_ACTIVE_MIN_GUIDELINE} minutes a week. ${fmt(WEEKLY_ACTIVE_MIN_GUIDELINE - weekActive)} more minutes gets you there.`,
						metric: 'activeMinutes',
					},
		)
	}
	return out
}

function heartInsights(input: InsightInput): Insight[] {
	const out: Insight[] = []
	const sys = input.metrics.systolic
	const dia = input.metrics.diastolic
	if (sys.trend === 'down' && sys.avg30 !== null && sys.changePct30 !== null) {
		out.push({
			id: 'bp-improving',
			severity: 'positive',
			title: 'Blood pressure is trending down',
			detail: `Your 30-day average is ${fmt(sys.avg30)}/${fmt(dia.avg30 ?? 0)} mmHg, ${fmt(Math.abs(sys.changePct30), 1)}% lower (systolic) than the 30 days before.`,
			metric: 'systolic',
		})
	} else if (sys.trend === 'up' && sys.avg30 !== null) {
		out.push({
			id: 'bp-rising',
			severity: 'warning',
			title: 'Blood pressure is trending up',
			detail: `Your 30-day average is ${fmt(sys.avg30)}/${fmt(dia.avg30 ?? 0)} mmHg. Keep measuring and mention it to your doctor.`,
			metric: 'systolic',
		})
	}
	if (sys.avg7 !== null && dia.avg7 !== null && (sys.avg7 >= 120 || dia.avg7 >= 80)) {
		out.push({
			id: 'bp-above-normal',
			severity: 'info',
			title: `This week's average is ${fmt(sys.avg7)}/${fmt(dia.avg7)} mmHg`,
			detail:
				'Still above the 120/80 normal range. Keep taking readings at the same time of day and share the trend at your follow-up.',
			metric: 'systolic',
		})
	}

	const rhr = input.metrics.restingHeartRate
	if (rhr.trend === 'down' && rhr.avg30 !== null && rhr.changePct30 !== null) {
		out.push({
			id: 'rhr-down',
			severity: 'positive',
			title: 'Resting heart rate is easing down',
			detail: `Averaging ${fmt(rhr.avg30)} bpm over 30 days, ${fmt(Math.abs(rhr.changePct30), 1)}% lower than before, a common sign of improving fitness.`,
			metric: 'restingHeartRate',
		})
	}
	return out
}

function bodyInsights(input: InsightInput): Insight[] {
	const out: Insight[] = []
	const weight = input.metrics.weightKg
	const readings = input.days
		.filter((d) => d.weightKg !== null)
		.toSorted((a, b) => a.date.localeCompare(b.date))
	const first = readings[0]?.weightKg ?? null
	if (weight.trend === 'down' && first !== null && weight.latest !== null && first > weight.latest) {
		out.push({
			id: 'weight-down',
			severity: 'positive',
			title: `Down ${fmt(first - weight.latest, 1)} kg since you started tracking`,
			detail: `From ${fmt(first, 1)} kg to ${fmt(weight.latest, 1)} kg. A steady pace like this is the kind that lasts.`,
			metric: 'weightKg',
		})
	}

	const protein = input.metrics.proteinG
	const proteinGoal = input.goalDefs.find(
		(g) => g.metric === 'proteinG' && g.direction === 'atLeast',
	)
	if (proteinGoal && protein.avg7 !== null && protein.avg7 < proteinGoal.target * 0.9) {
		out.push({
			id: 'protein-low',
			severity: 'warning',
			title: `Protein is averaging ${fmt(protein.avg7)} g a day`,
			detail: `Your target is ${fmt(proteinGoal.target)} g. Adding a protein source to breakfast closes most of the gap.`,
			metric: 'proteinG',
		})
	}

	const water = input.metrics.waterMl
	if (water.avg7 !== null && water.avg7 < WATER_TARGET_ML) {
		out.push({
			id: 'hydration',
			severity: 'info',
			title: `Water intake is about ${fmt(water.avg7 / 1000, 1)} L a day`,
			detail: `Aim for around ${fmt(WATER_TARGET_ML / 1000)} L, more on walking days.`,
			metric: 'waterMl',
		})
	}
	return out
}

function staleDataInsights(input: InsightInput): Insight[] {
	const tracked: MetricKey[] = ['sleepMinutes', 'weightKg', 'systolic']
	const stale = tracked
		.map((key) => input.metrics[key])
		.filter((m) => m.latestDate === null || daysBetween(m.latestDate, input.asOf) >= STALE_AFTER_DAYS)
	if (stale.length === 0) return []
	return [
		{
			id: 'stale-data',
			severity: 'info',
			title: `No recent ${stale.map((m) => m.label.toLowerCase()).join(', ')} data`,
			detail: `Nothing logged in the last ${STALE_AFTER_DAYS} days, so those numbers may be out of date.`,
			metric: stale[0].key,
		},
	]
}

const SEVERITY_ORDER: Record<Insight['severity'], number> = { warning: 0, positive: 1, info: 2 }

/** All insights, warnings first, then positives, then info. */
export function buildInsights(input: InsightInput): Insight[] {
	const all = [
		...sleepInsights(input),
		...activityInsights(input),
		...heartInsights(input),
		...bodyInsights(input),
		...staleDataInsights(input),
	]
	return all
		.map((insight, index) => ({ insight, index }))
		.toSorted(
			(a, b) =>
				SEVERITY_ORDER[a.insight.severity] - SEVERITY_ORDER[b.insight.severity] || a.index - b.index,
		)
		.map(({ insight }) => insight)
}
