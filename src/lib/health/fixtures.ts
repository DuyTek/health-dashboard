import type { DailyMetrics, Goal, HealthData, IsoDate, Persona } from '../../types/health.js'
import { addDays } from './dates.js'

// Small hand-built fixtures for unit tests (not shipped in the UI bundle).

export const TEST_PERSONA: Persona = {
	id: 'test',
	name: 'Test User',
	age: 40,
	sex: 'other',
	heightCm: 170,
	occupation: 'Tester',
	location: 'Nowhere',
	healthContext: [],
	motivation: 'Testing',
}

export function makeDay(date: IsoDate, overrides: Partial<DailyMetrics> = {}): DailyMetrics {
	return {
		date,
		steps: 8000,
		activeMinutes: 30,
		caloriesBurned: 2300,
		restingHeartRate: 65,
		hrvMs: 40,
		sleep: {
			totalMinutes: 450,
			deepMinutes: 80,
			remMinutes: 100,
			lightMinutes: 270,
			awakeMinutes: 20,
			bedtime: '23:00',
		},
		nutrition: { calories: 2100, proteinG: 120, carbsG: 230, fatG: 70, waterMl: 2200 },
		weightKg: 80,
		bloodPressure: { systolic: 118, diastolic: 76 },
		mood: 4,
		...overrides,
	}
}

/** `count` consecutive days ending at `asOf`, each customised by `fn(index from oldest)`. */
export function makeDays(
	asOf: IsoDate,
	count: number,
	fn: (i: number, date: IsoDate) => Partial<DailyMetrics> = () => ({}),
): DailyMetrics[] {
	return Array.from({ length: count }, (_, i) => {
		const date = addDays(asOf, i - (count - 1))
		return makeDay(date, fn(i, date))
	})
}

export function makeData(
	days: DailyMetrics[],
	goals: Goal[] = [],
	asOf: IsoDate = days.at(-1)?.date ?? '2026-01-01',
): HealthData {
	return { persona: TEST_PERSONA, asOf, days, activities: [], goals }
}
