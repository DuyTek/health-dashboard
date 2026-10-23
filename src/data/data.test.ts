import { addDays } from '../lib/health/dates'
import { AS_OF, DATASET_DAYS, generateHealthData, getHealthData, ROUTINE_START } from './index'
import { gaussian, mulberry32 } from './prng'

describe('mulberry32', () => {
	it('is deterministic for a seed and stays in [0, 1)', () => {
		const a = mulberry32(42)
		const b = mulberry32(42)
		const seqA = Array.from({ length: 100 }, a)
		const seqB = Array.from({ length: 100 }, b)
		expect(seqA).toEqual(seqB)
		expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
	})

	it('produces finite gaussian samples', () => {
		const rng = mulberry32(1)
		const xs = Array.from({ length: 500 }, () => gaussian(rng, 10, 2))
		const avg = xs.reduce((s, x) => s + x, 0) / xs.length
		expect(avg).toBeGreaterThan(9.5)
		expect(avg).toBeLessThan(10.5)
	})
})

describe('getHealthData', () => {
	const data = getHealthData()

	it('is memoized and identical to a fresh generation (deterministic)', () => {
		expect(getHealthData()).toBe(data)
		expect(generateHealthData()).toEqual(data)
	})

	it('changes with a different seed', () => {
		expect(generateHealthData({ seed: 7 }).days).not.toEqual(data.days)
	})

	it('covers 90 consecutive days ending at asOf', () => {
		expect(data.asOf).toBe(AS_OF)
		expect(data.days).toHaveLength(DATASET_DAYS)
		expect(data.days[0].date).toBe(addDays(AS_OF, -(DATASET_DAYS - 1)))
		expect(data.days.at(-1)?.date).toBe(AS_OF)
		data.days.forEach((d, i) => expect(d.date).toBe(addDays(data.days[0].date, i)))
	})

	it('has plausible values and some missing readings', () => {
		for (const d of data.days) {
			expect(d.steps).toBeGreaterThan(1000)
			expect(d.restingHeartRate).toBeGreaterThan(50)
			expect(d.restingHeartRate).toBeLessThan(90)
		}
		const sleeps = data.days.flatMap((d) => (d.sleep ? [d.sleep] : []))
		for (const sl of sleeps) {
			expect(sl.deepMinutes + sl.remMinutes + sl.lightMinutes).toBe(sl.totalMinutes)
			expect(sl.bedtime).toMatch(/^\d{2}:\d{2}$/)
		}
		const bps = data.days.flatMap((d) => (d.bloodPressure ? [d.bloodPressure] : []))
		for (const bp of bps) expect(bp.systolic).toBeGreaterThan(bp.diastolic)
		expect(data.days.some((d) => d.sleep === null)).toBe(true)
		expect(data.days.some((d) => d.weightKg === null)).toBe(true)
		expect(data.days.some((d) => d.nutrition === null)).toBe(true)
		const bpCount = bps.length
		expect(bpCount).toBeGreaterThan(30)
		expect(bpCount).toBeLessThan(45)
	})

	it('tells the walking-routine story: more steps after the routine started', () => {
		const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
		const before = data.days.filter((d) => d.date < ROUTINE_START).map((d) => d.steps)
		const after = data.days.filter((d) => d.date >= addDays(ROUTINE_START, 14)).map((d) => d.steps)
		expect(avg(after)).toBeGreaterThan(avg(before) * 1.3)
	})

	it('logs activities with unique ids inside the date range', () => {
		const ids = new Set(data.activities.map((a) => a.id))
		expect(ids.size).toBe(data.activities.length)
		const perWeek = data.activities.filter((a) => a.date >= ROUTINE_START).length / 6
		expect(perWeek).toBeGreaterThanOrEqual(3)
		expect(perWeek).toBeLessThanOrEqual(7)
		for (const a of data.activities) {
			expect(a.date >= data.days[0].date && a.date <= AS_OF).toBe(true)
		}
	})

	it('has goals for metrics the dataset tracks', () => {
		expect(data.goals.length).toBeGreaterThanOrEqual(4)
		expect(data.goals.length).toBeLessThanOrEqual(6)
	})
})
