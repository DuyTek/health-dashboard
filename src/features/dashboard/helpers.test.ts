import { getHealthData } from '@/data'
import { buildTrendData, hasValues } from './chartData'
import { formatHoursMinutes, formatLongDate } from './format'
import { compareToAverage } from './kpi'

describe('compareToAverage', () => {
	it('colors by whether the change is good for that metric', () => {
		expect(compareToAverage(9000, 8000, true)?.tone).toBe('good')
		expect(compareToAverage(7000, 8000, true)?.tone).toBe('bad')
		expect(compareToAverage(72, 66, false)?.tone).toBe('bad')
		expect(compareToAverage(62, 66, false)?.tone).toBe('good')
	})

	it('is neutral inside the tolerance and null without data', () => {
		expect(compareToAverage(8050, 8000, true)?.tone).toBe('neutral')
		expect(compareToAverage(null, 8000, true)).toBeNull()
		expect(compareToAverage(10, null, true)).toBeNull()
	})
})

describe('buildTrendData', () => {
	const data = getHealthData()

	it('returns daily rows for 7 and 30 days', () => {
		expect(buildTrendData(data, 7)).toMatchObject({ weekly: false })
		expect(buildTrendData(data, 7).rows).toHaveLength(7)
		expect(buildTrendData(data, 30).rows).toHaveLength(30)
	})

	it('aggregates 90 days into weekly rows', () => {
		const { rows, weekly } = buildTrendData(data, 90)
		expect(weekly).toBe(true)
		expect(rows.length).toBeGreaterThanOrEqual(13)
		expect(rows.length).toBeLessThanOrEqual(14)
		expect(hasValues(rows, 'systolic')).toBe(true)
	})
})

describe('format', () => {
	it('formats dates in UTC and durations compactly', () => {
		expect(formatLongDate('2026-10-22')).toBe('Thursday, October 22, 2026')
		expect(formatHoursMinutes(402)).toBe('6h 42m')
		expect(formatHoursMinutes(45)).toBe('45m')
	})
})
