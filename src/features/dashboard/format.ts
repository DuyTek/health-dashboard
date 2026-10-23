import type { IsoDate } from '@/types/health'

// Display formatting. Dates are calendar dates, so format them in UTC to avoid
// the user's time zone shifting them by a day.

const toDate = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`)

const longDate = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC',
})
const mediumDate = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC',
})
const shortDate = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC',
})
const weekdayDate = new Intl.DateTimeFormat('en-US', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC',
})

export const formatLongDate = (iso: IsoDate) => longDate.format(toDate(iso))
export const formatMediumDate = (iso: IsoDate) => mediumDate.format(toDate(iso))
export const formatShortDate = (iso: IsoDate) => shortDate.format(toDate(iso))
export const formatWeekdayDate = (iso: IsoDate) => weekdayDate.format(toDate(iso))

export function formatNumber(value: number, decimals = 0): string {
	return value.toLocaleString('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	})
}

/** 402 → "6h 42m" (compact, for tiles and axes). */
export function formatHoursMinutes(minutes: number): string {
	const m = Math.round(minutes)
	const h = Math.floor(m / 60)
	const rest = m % 60
	return h === 0 ? `${rest}m` : `${h}h ${String(rest).padStart(2, '0')}m`
}
