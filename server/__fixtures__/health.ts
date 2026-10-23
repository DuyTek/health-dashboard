import type {
	Activity,
	DailyMetrics,
	Goal,
	HealthData,
	HealthSummary,
	MetricKey,
	MetricSummary,
} from '../../src/types/health.js'
import { shiftIsoDate } from '../metrics.js'

// Small deterministic dataset for server tests. The real dataset and summary
// builder live in src/data and src/lib/health (owned by another branch); tests
// inject these fixtures instead of calling them.

export const FIXTURE_AS_OF = '2026-03-31'
const DAY_COUNT = 60

function makeDay(index: number): DailyMetrics {
	const date = shiftIsoDate(FIXTURE_AS_OF, index - (DAY_COUNT - 1))
	const measuredBp = index % 7 === 0
	return {
		date,
		steps: 6000 + index * 50,
		activeMinutes: 20 + (index % 10),
		caloriesBurned: 2100 + index,
		restingHeartRate: 68 - Math.floor(index / 20),
		hrvMs: index % 3 === 0 ? null : 40 + (index % 5),
		sleep:
			index % 9 === 0
				? null
				: {
						totalMinutes: 400 + (index % 6) * 5,
						deepMinutes: 70,
						remMinutes: 90,
						lightMinutes: 220,
						awakeMinutes: 20,
						bedtime: '23:15',
					},
		nutrition: {
			calories: 2200 + (index % 4) * 25,
			proteinG: 90 + (index % 3) * 5,
			carbsG: 250,
			fatG: 70,
			waterMl: 1800 + (index % 5) * 100,
		},
		weightKg: index % 7 === 3 ? 82 - index * 0.02 : null,
		bloodPressure: measuredBp ? { systolic: 132 - Math.floor(index / 15), diastolic: 85 } : null,
		mood: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
	}
}

const days: DailyMetrics[] = Array.from({ length: DAY_COUNT }, (_, i) => makeDay(i))

const activities: Activity[] = [
	{
		id: 'a1',
		date: FIXTURE_AS_OF,
		type: 'run',
		title: 'Morning run',
		durationMin: 32,
		distanceKm: 5.2,
		caloriesBurned: 340,
		avgHeartRate: 148,
	},
	{
		id: 'a2',
		date: shiftIsoDate(FIXTURE_AS_OF, -2),
		type: 'strength',
		title: 'Gym session',
		durationMin: 45,
		distanceKm: null,
		caloriesBurned: 260,
		avgHeartRate: 118,
	},
	{
		id: 'a3',
		date: shiftIsoDate(FIXTURE_AS_OF, -10),
		type: 'run',
		title: 'Easy run',
		durationMin: 28,
		distanceKm: 4.4,
		caloriesBurned: 290,
		avgHeartRate: 142,
	},
	{
		id: 'a4',
		date: shiftIsoDate(FIXTURE_AS_OF, -40),
		type: 'yoga',
		title: 'Yoga flow',
		durationMin: 30,
		distanceKm: null,
		caloriesBurned: 110,
		avgHeartRate: null,
	},
]

const goals: Goal[] = [
	{
		id: 'g-steps',
		metric: 'steps',
		label: 'Daily steps',
		target: 8000,
		unit: 'steps',
		direction: 'atLeast',
		basis: 'avg7',
		baseline: 6000,
		deadline: '2026-06-30',
	},
	{
		id: 'g-weight',
		metric: 'weightKg',
		label: 'Body weight',
		target: 78,
		unit: 'kg',
		direction: 'atMost',
		basis: 'latest',
		baseline: 82,
		deadline: null,
	},
]

export const fixtureData: HealthData = {
	persona: {
		id: 'p1',
		name: 'Alex Rivera',
		age: 38,
		sex: 'male',
		heightCm: 178,
		occupation: 'Product designer',
		location: 'Lisbon, Portugal',
		healthContext: ['Pre-hypertension flagged at last check-up'],
		motivation: 'I want to bring my blood pressure down and have more energy.',
	},
	asOf: FIXTURE_AS_OF,
	days,
	activities,
	goals,
}

function metric(key: MetricKey, overrides: Partial<MetricSummary> = {}): MetricSummary {
	return {
		key,
		label: key,
		unit: 'unit',
		latest: 10.123456,
		latestDate: FIXTURE_AS_OF,
		avg7: 10.04,
		avg30: 9.96,
		avg90: null,
		changePct30: 3.14159,
		trend: 'up',
		higherIsBetter: true,
		dataPoints: 60,
		...overrides,
	}
}

export const fixtureSummary: HealthSummary = {
	asOf: FIXTURE_AS_OF,
	persona: fixtureData.persona,
	periodStart: days[0].date,
	metrics: {
		steps: metric('steps', { label: 'Steps', unit: 'steps', latest: 8950, avg7: 8800.4 }),
		activeMinutes: metric('activeMinutes'),
		sleepMinutes: metric('sleepMinutes', { label: 'Sleep', unit: 'min' }),
		restingHeartRate: metric('restingHeartRate', { higherIsBetter: false, trend: 'down' }),
		hrvMs: metric('hrvMs'),
		weightKg: metric('weightKg', { higherIsBetter: false }),
		caloriesIn: metric('caloriesIn'),
		proteinG: metric('proteinG'),
		waterMl: metric('waterMl'),
		systolic: metric('systolic', { label: 'Systolic BP', unit: 'mmHg', latest: 128 }),
		diastolic: metric('diastolic'),
		mood: metric('mood', { latest: null, latestDate: null, trend: 'flat', dataPoints: 0 }),
	},
	goals: [
		{
			goalId: 'g-steps',
			metric: 'steps',
			label: 'Daily steps',
			current: 8800.4,
			target: 8000,
			baseline: 6000,
			unit: 'steps',
			progressPct: 100,
			status: 'achieved',
		},
		{
			goalId: 'g-weight',
			metric: 'weightKg',
			label: 'Body weight',
			current: 80.9,
			target: 78,
			baseline: 82,
			unit: 'kg',
			progressPct: 27.5,
			status: 'behind',
		},
	],
	recentActivities: activities,
	activityTotals: {
		last7: { sessions: 2, minutes: 77 },
		last30: { sessions: 3, minutes: 105 },
	},
	insights: [
		{
			id: 'i1',
			severity: 'positive',
			title: 'Steps are up',
			detail: 'Your 7-day step average is above your goal.',
			metric: 'steps',
		},
	],
}
