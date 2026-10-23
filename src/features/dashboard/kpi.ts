export type Tone = 'good' | 'bad' | 'neutral'

export interface Comparison {
	delta: number
	tone: Tone
}

/**
 * Compare a reading to its 7-day average. Changes within `tolerancePct` are
 * neutral, so day-to-day noise doesn't flash red or green.
 */
export function compareToAverage(
	latest: number | null,
	average: number | null,
	higherIsBetter: boolean,
	tolerancePct = 2,
): Comparison | null {
	if (latest === null || average === null || average === 0) return null
	const delta = latest - average
	if (Math.abs(delta / average) * 100 < tolerancePct) return { delta, tone: 'neutral' }
	const improved = higherIsBetter ? delta > 0 : delta < 0
	return { delta, tone: improved ? 'good' : 'bad' }
}
