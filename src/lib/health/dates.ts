import type { IsoDate } from '../../types/health.js'

// Calendar-date helpers on `YYYY-MM-DD` strings. All arithmetic is done in UTC
// so results never depend on the runtime's time zone.

const DAY_MS = 86_400_000

export function parseIsoDate(date: IsoDate): number {
	const [y, m, d] = date.split('-').map(Number)
	return Date.UTC(y, m - 1, d)
}

export function formatIsoDate(ms: number): IsoDate {
	return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
	return formatIsoDate(parseIsoDate(date) + days * DAY_MS)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
	return Math.round((parseIsoDate(to) - parseIsoDate(from)) / DAY_MS)
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
	return new Date(parseIsoDate(date)).getUTCDay()
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
	const offset = (dayOfWeek(date) + 6) % 7
	return addDays(date, -offset)
}

/** Inclusive window of `days` days ending at `end`. */
export function inWindow(date: IsoDate, end: IsoDate, days: number): boolean {
	const diff = daysBetween(date, end)
	return diff >= 0 && diff < days
}
