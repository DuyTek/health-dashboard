// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixtureData, fixtureSummary, FIXTURE_AS_OF } from './__fixtures__/health.js'
import {
	createHealthTools,
	getActivities,
	getGoals,
	getMetricHistory,
	type ActivitiesResult,
	type MetricHistoryResult,
} from './tools.js'

describe('getMetricHistory', () => {
	it('returns dated values inside the window plus stats', () => {
		const result = getMetricHistory({ metric: 'steps', days: 7 }, fixtureData) as MetricHistoryResult
		expect(result.from).toBe('2026-03-25')
		expect(result.to).toBe(FIXTURE_AS_OF)
		expect(result.points).toHaveLength(7)
		expect(result.points.at(-1)).toEqual({ date: FIXTURE_AS_OF, value: 6000 + 59 * 50 })
		expect(result.stats?.max).toBe(8950)
		expect(result.stats?.min).toBe(8650)
		expect(result.unit).toBe('steps')
	})

	it('skips days without a reading and reports coverage', () => {
		const result = getMetricHistory(
			{ metric: 'systolic', days: 30 },
			fixtureData,
		) as MetricHistoryResult
		expect(result.daysInWindow).toBe(30)
		expect(result.daysWithData).toBeLessThan(30)
		expect(result.points.every((p) => typeof p.value === 'number')).toBe(true)
	})

	it('defaults to 30 days', () => {
		const result = getMetricHistory({ metric: 'mood' }, fixtureData) as MetricHistoryResult
		expect(result.daysInWindow).toBe(30)
	})

	it('returns stats null when there is no data', () => {
		const empty = { ...fixtureData, days: [] }
		const result = getMetricHistory({ metric: 'steps' }, empty) as MetricHistoryResult
		expect(result.points).toEqual([])
		expect(result.stats).toBeNull()
	})

	it.each([
		[{ metric: 'bloodGlucose' }],
		[{ metric: 'steps', days: 3 }],
		[{ metric: 'steps', days: 365 }],
		[{ metric: 'steps', days: 'ten' }],
		[{}],
		['steps'],
	])('returns an error object for invalid args %j', (args) => {
		const result = getMetricHistory(args, fixtureData)
		expect(result).toHaveProperty('error')
		expect((result as { error: string }).error).toMatch(/Invalid arguments/)
	})
})

describe('getActivities', () => {
	it('lists activities in the window, newest first, with totals', () => {
		const result = getActivities({ days: 30 }, fixtureData) as ActivitiesResult
		expect(result.activities.map((a) => a.title)).toEqual(['Morning run', 'Gym session', 'Easy run'])
		expect(result.sessions).toBe(3)
		expect(result.totalMinutes).toBe(32 + 45 + 28)
		expect(result.totalDistanceKm).toBe(9.6)
		expect(result.byType.run).toEqual({ sessions: 2, minutes: 60 })
	})

	it('filters by type', () => {
		const result = getActivities({ days: 90, type: 'yoga' }, fixtureData) as ActivitiesResult
		expect(result.activities).toHaveLength(1)
		expect(result.type).toBe('yoga')
	})

	it('accepts no args', () => {
		expect(getActivities(undefined, fixtureData)).toHaveProperty('sessions', 3)
	})

	it('rejects an unknown type', () => {
		expect(getActivities({ type: 'skydiving' }, fixtureData)).toHaveProperty('error')
	})
})

describe('getGoals', () => {
	it('merges goal definitions with progress', () => {
		const { goals } = getGoals({ data: fixtureData, summary: fixtureSummary })
		expect(goals).toHaveLength(2)
		expect(goals[0]).toMatchObject({
			id: 'g-steps',
			target: 8000,
			current: 8800.4,
			status: 'achieved',
			deadline: '2026-06-30',
		})
		expect(goals[1]).toMatchObject({ direction: 'atMost', progressPct: 28, status: 'behind' })
	})

	it('reports no-data when the summary has no progress for a goal', () => {
		const { goals } = getGoals({ data: fixtureData, summary: { ...fixtureSummary, goals: [] } })
		expect(goals[0]).toMatchObject({ current: null, progressPct: null, status: 'no-data' })
	})
})

describe('createHealthTools', () => {
	it('exposes three named ADK tools', () => {
		const tools = createHealthTools({ data: fixtureData, summary: fixtureSummary })
		expect(tools.map((t) => t.name)).toEqual(['get_metric_history', 'get_activities', 'get_goals'])
		const declaration = tools[0]._getDeclaration()
		expect(JSON.stringify(declaration.parameters ?? declaration.parametersJsonSchema)).toContain(
			'restingHeartRate',
		)
	})
})
