import type { Activity, Goal, MetricSummary } from '../../types/health'
import { getHealthData } from '../../data'
import { makeData, makeDay, makeDays } from './fixtures'
import {
	buildHealthSummary,
	computeGoalProgress,
	percentChange,
	summarizeMetric,
	trendFromChange,
} from './summary'

const ASOF = '2026-03-31'

describe('percentChange / trendFromChange', () => {
	it('computes percent change and guards nulls and zero', () => {
		expect(percentChange(110, 100)).toBeCloseTo(10)
		expect(percentChange(90, 100)).toBeCloseTo(-10)
		expect(percentChange(null, 100)).toBeNull()
		expect(percentChange(5, 0)).toBeNull()
	})

	it('treats changes inside the dead-band as flat', () => {
		expect(trendFromChange(2.9, 3)).toBe('flat')
		expect(trendFromChange(-2.9, 3)).toBe('flat')
		expect(trendFromChange(3, 3)).toBe('up')
		expect(trendFromChange(-3.1, 3)).toBe('down')
		expect(trendFromChange(null, 3)).toBe('flat')
	})
})

describe('summarizeMetric', () => {
	it('averages over 7/30/90-day windows ending at asOf', () => {
		// 60 days: first 30 at 5,000 steps, last 30 at 10,000 except the last 7 at 12,000.
		const days = makeDays(ASOF, 60, (i) => ({ steps: i < 30 ? 5000 : i >= 53 ? 12000 : 10000 }))
		const s = summarizeMetric(days, 'steps', ASOF)
		expect(s.avg7).toBe(12000)
		expect(s.avg30).toBe(Math.round((23 * 10000 + 7 * 12000) / 30))
		expect(s.avg90).toBe(Math.round((30 * 5000 + 23 * 10000 + 7 * 12000) / 60))
		expect(s.latest).toBe(12000)
		expect(s.latestDate).toBe(ASOF)
		expect(s.changePct30).toBeCloseTo(((s.avg30! - 5000) / 5000) * 100, 0)
		expect(s.trend).toBe('up')
		expect(s.higherIsBetter).toBe(true)
		expect(s.dataPoints).toBe(60)
	})

	it('skips nulls, finds the latest non-null reading, and is null with no data', () => {
		const days = makeDays(ASOF, 10, (i) => ({ weightKg: i === 5 ? 82.3 : null }))
		const s = summarizeMetric(days, 'weightKg', ASOF)
		expect(s.latest).toBe(82.3)
		expect(s.latestDate).toBe(days[5].date)
		expect(s.avg7).toBe(82.3)
		expect(s.dataPoints).toBe(1)
		expect(s.changePct30).toBeNull()
		expect(s.trend).toBe('flat')

		const none = summarizeMetric(
			makeDays(ASOF, 10, () => ({ sleep: null })),
			'sleepMinutes',
			ASOF,
		)
		expect(none.latest).toBeNull()
		expect(none.avg7).toBeNull()
		expect(none.dataPoints).toBe(0)
	})

	it('uses per-metric dead-bands (weight is tighter than steps)', () => {
		// 2% weight drop is a real trend; a 2% step change is noise.
		const days = makeDays(ASOF, 60, (i) => ({
			weightKg: i < 30 ? 85 : 83.3,
			steps: i < 30 ? 8000 : 8160,
		}))
		expect(summarizeMetric(days, 'weightKg', ASOF).trend).toBe('down')
		expect(summarizeMetric(days, 'steps', ASOF).trend).toBe('flat')
		expect(summarizeMetric(days, 'weightKg', ASOF).higherIsBetter).toBe(false)
	})
})

function metric(partial: Partial<MetricSummary>): MetricSummary {
	return {
		key: 'steps',
		label: 'Steps',
		unit: 'steps',
		latest: null,
		latestDate: null,
		avg7: null,
		avg30: null,
		avg90: null,
		changePct30: null,
		trend: 'flat',
		higherIsBetter: true,
		dataPoints: 0,
		...partial,
	}
}

const stepsGoal: Goal = {
	id: 'g-steps',
	metric: 'steps',
	label: 'Steps',
	target: 8000,
	unit: 'steps',
	direction: 'atLeast',
	basis: 'avg7',
	baseline: 6000,
	deadline: null,
}

const weightGoal: Goal = {
	id: 'g-weight',
	metric: 'weightKg',
	label: 'Weight',
	target: 80,
	unit: 'kg',
	direction: 'atMost',
	basis: 'latest',
	baseline: 90,
	deadline: null,
}

describe('computeGoalProgress', () => {
	it('atLeast: progress from baseline toward target, achieved when met', () => {
		expect(computeGoalProgress(stepsGoal, metric({ avg7: 7000 }))).toMatchObject({
			current: 7000,
			progressPct: 50,
			status: 'behind',
		})
		expect(computeGoalProgress(stepsGoal, metric({ avg7: 7000, trend: 'up' })).status).toBe(
			'on-track',
		)
		expect(computeGoalProgress(stepsGoal, metric({ avg7: 7600 })).status).toBe('on-track')
		expect(computeGoalProgress(stepsGoal, metric({ avg7: 8500 }))).toMatchObject({
			progressPct: 100,
			status: 'achieved',
		})
		expect(computeGoalProgress(stepsGoal, metric({ avg7: 5000 })).progressPct).toBe(0)
	})

	it('atMost: uses the latest reading when basis is latest', () => {
		const m = metric({ key: 'weightKg', latest: 87, avg7: 95, trend: 'down' })
		expect(computeGoalProgress(weightGoal, m)).toMatchObject({
			current: 87,
			progressPct: 30,
			status: 'on-track',
		})
		expect(computeGoalProgress(weightGoal, metric({ latest: 87, trend: 'up' })).status).toBe('behind')
		expect(computeGoalProgress(weightGoal, metric({ latest: 79.5 })).status).toBe('achieved')
	})

	it('reports no-data when there is no current value', () => {
		expect(computeGoalProgress(weightGoal, metric({ latest: null }))).toMatchObject({
			current: null,
			progressPct: 0,
			status: 'no-data',
		})
	})
})

describe('buildHealthSummary', () => {
	it('computes activity totals, recent activities and periodStart', () => {
		const days = makeDays(ASOF, 40)
		const activity = (id: string, date: string, durationMin: number): Activity => ({
			id,
			date,
			type: 'walk',
			title: 'Walk',
			durationMin,
			distanceKm: 2,
			caloriesBurned: 100,
			avgHeartRate: 100,
		})
		const data = {
			...makeData(days, [stepsGoal]),
			activities: [
				activity('a1', '2026-03-31', 30),
				activity('a2', '2026-03-25', 20),
				activity('a3', '2026-03-10', 40),
				activity('a4', '2026-02-01', 60),
			],
		}
		const s = buildHealthSummary(data)
		expect(s.asOf).toBe(ASOF)
		expect(s.periodStart).toBe(days[0].date)
		expect(s.activityTotals.last7).toEqual({ sessions: 2, minutes: 50 })
		expect(s.activityTotals.last30).toEqual({ sessions: 3, minutes: 90 })
		expect(s.recentActivities.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
		expect(s.goals).toHaveLength(1)
		expect(Object.keys(s.metrics)).toHaveLength(12)
	})

	it('summarizes the generated dataset into the intended story', () => {
		const s = buildHealthSummary(getHealthData())
		expect(s.metrics.steps.trend).toBe('up')
		expect(s.metrics.weightKg.trend).toBe('down')
		expect(s.metrics.systolic.trend).toBe('down')
		expect(s.goals.every((g) => g.status !== 'no-data')).toBe(true)
		const ids = s.insights.map((i) => i.id)
		expect(ids).toEqual(expect.arrayContaining(['steps-up', 'bp-improving', 'protein-low']))
	})

	it('handles a dataset with no days', () => {
		const s = buildHealthSummary(makeData([], [stepsGoal], ASOF))
		expect(s.metrics.steps.latest).toBeNull()
		expect(s.goals[0].status).toBe('no-data')
		expect(s.periodStart).toBe(ASOF)
	})

	it('ignores days after asOf', () => {
		const days = [makeDay('2026-03-30', { steps: 1000 }), makeDay('2026-04-02', { steps: 9999 })]
		const s = buildHealthSummary(makeData(days, [], '2026-03-31'))
		expect(s.metrics.steps.latest).toBe(1000)
	})
})
