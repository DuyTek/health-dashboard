import type { Goal } from '../../types/health'
import { makeData, makeDays } from './fixtures'
import { formatDuration } from './insights'
import { buildHealthSummary } from './summary'

const ASOF = '2026-03-31'

const proteinGoal: Goal = {
	id: 'g-protein',
	metric: 'proteinG',
	label: 'Protein',
	target: 120,
	unit: 'g',
	direction: 'atLeast',
	basis: 'avg7',
	baseline: 80,
	deadline: null,
}

const insightIds = (days: ReturnType<typeof makeDays>, goals: Goal[] = []) =>
	buildHealthSummary(makeData(days, goals)).insights.map((i) => i.id)

describe('formatDuration', () => {
	it('formats minutes as hours and minutes', () => {
		expect(formatDuration(45)).toBe('45 min')
		expect(formatDuration(420)).toBe('7 h')
		expect(formatDuration(402.4)).toBe('6 h 42 min')
	})
})

describe('insights', () => {
	it('baseline healthy fixture produces positives and no warnings', () => {
		const insights = buildHealthSummary(makeData(makeDays(ASOF, 60), [proteinGoal])).insights
		expect(insights.some((i) => i.severity === 'warning')).toBe(false)
		expect(insights.map((i) => i.id)).toEqual(
			expect.arrayContaining(['sleep-good', 'active-guideline']),
		)
	})

	it('warns when sleep averages under 7 hours', () => {
		const days = makeDays(ASOF, 14, () => ({
			sleep: {
				totalMinutes: 380,
				deepMinutes: 60,
				remMinutes: 80,
				lightMinutes: 240,
				awakeMinutes: 30,
				bedtime: '23:30',
			},
		}))
		const summary = buildHealthSummary(makeData(days))
		const sleep = summary.insights.find((i) => i.id === 'sleep-short')
		expect(sleep?.severity).toBe('warning')
		expect(sleep?.title).toContain('6 h 20 min')
		// Warnings are listed first.
		expect(summary.insights[0].severity).toBe('warning')
	})

	it('links late bedtimes to shorter sleep', () => {
		const days = makeDays(ASOF, 30, (i) => {
			const late = i % 3 === 0
			return {
				sleep: {
					totalMinutes: late ? 360 : 440,
					deepMinutes: 60,
					remMinutes: 80,
					lightMinutes: late ? 220 : 300,
					awakeMinutes: 20,
					bedtime: late ? '00:45' : '23:00',
				},
			}
		})
		expect(insightIds(days)).toContain('sleep-late-bedtime')
	})

	it('flags steps up or down by at least 10% vs the prior 30 days', () => {
		expect(insightIds(makeDays(ASOF, 60, (i) => ({ steps: i < 30 ? 6000 : 7000 })))).toContain(
			'steps-up',
		)
		expect(insightIds(makeDays(ASOF, 60, (i) => ({ steps: i < 30 ? 8000 : 6000 })))).toContain(
			'steps-down',
		)
		expect(insightIds(makeDays(ASOF, 60, (i) => ({ steps: i < 30 ? 8000 : 8400 })))).not.toEqual(
			expect.arrayContaining(['steps-up']),
		)
	})

	it('reports improving blood pressure and an above-normal weekly average', () => {
		const days = makeDays(ASOF, 60, (i) => ({
			bloodPressure: i < 30 ? { systolic: 138, diastolic: 88 } : { systolic: 128, diastolic: 83 },
		}))
		const ids = insightIds(days)
		expect(ids).toContain('bp-improving')
		expect(ids).toContain('bp-above-normal')
		expect(ids).not.toContain('bp-rising')
	})

	it('warns when protein is well below the goal target', () => {
		const days = makeDays(ASOF, 14, () => ({
			nutrition: { calories: 2000, proteinG: 85, carbsG: 250, fatG: 70, waterMl: 2200 },
		}))
		expect(insightIds(days, [proteinGoal])).toContain('protein-low')
		// Without a protein goal there is no target to compare against.
		expect(insightIds(days)).not.toContain('protein-low')
	})

	it('notes weight loss since the first reading', () => {
		const days = makeDays(ASOF, 60, (i) => ({ weightKg: i < 30 ? 86 : 84 }))
		const insight = buildHealthSummary(makeData(days)).insights.find((i) => i.id === 'weight-down')
		expect(insight?.title).toBe('Down 2.0 kg since you started tracking')
	})

	it('flags stale data when recent readings are missing', () => {
		const days = makeDays(ASOF, 20, (i) => ({ weightKg: i < 10 ? 80 : null }))
		expect(insightIds(days)).toContain('stale-data')
		expect(insightIds(makeDays(ASOF, 20))).not.toContain('stale-data')
	})
})
