import { startOfWeek } from './dates'
import { makeData, makeDays } from './fixtures'
import { aggregateWeekly, selectDays, selectSeries } from './series'

const ASOF = '2026-03-31' // a Tuesday

describe('series helpers', () => {
	it('selects the last N days, oldest first', () => {
		const data = makeData(makeDays(ASOF, 20, (i) => ({ steps: i })))
		const days = selectDays(data, 7)
		expect(days).toHaveLength(7)
		expect(days[0].date).toBe('2026-03-25')
		expect(days.at(-1)?.date).toBe(ASOF)
	})

	it('keeps nulls in a series so charts show gaps', () => {
		const data = makeData(makeDays(ASOF, 7, (i) => ({ weightKg: i % 2 ? null : 80 + i })))
		const series = selectSeries(data, 'weightKg', 7)
		expect(series.map((p) => p.value)).toEqual([80, null, 82, null, 84, null, 86])
	})

	it('aggregates by ISO week, averaging non-null values', () => {
		expect(startOfWeek(ASOF)).toBe('2026-03-30')
		const rows = [
			{ date: '2026-03-28', v: 10 },
			{ date: '2026-03-29', v: null },
			{ date: '2026-03-30', v: 4 },
			{ date: '2026-03-31', v: 6 },
		]
		expect(aggregateWeekly(rows, ['v'])).toEqual([
			{ weekStart: '2026-03-23', days: 2, values: { v: 10 } },
			{ weekStart: '2026-03-30', days: 2, values: { v: 5 } },
		])
	})
})
