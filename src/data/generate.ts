import { addDays, dayOfWeek, daysBetween } from '../lib/health/dates'
import type {
	Activity,
	ActivityType,
	DailyMetrics,
	HealthData,
	IsoDate,
	SleepRecord,
} from '../types/health'
import { AS_OF, DATASET_DAYS, GOALS, PERSONA, ROUTINE_START } from './persona'
import { chance, gaussian, mulberry32, type Rng } from './prng'

// Deterministic 90-day dataset for the persona. The story it tells:
// - Before ROUTINE_START: ~5,300 steps/day, an occasional weekend ride.
// - From ROUTINE_START a lunchtime walk habit ramps up over ~6 weeks: steps,
//   active minutes and HRV rise; resting HR, weight and blood pressure ease down.
// - Sleep stays the weak spot: late bedtimes (especially Fri/Sat nights) cost
//   sleep, HRV and next-morning resting HR. Protein stays below target.
// - Real-world gaps: watch not worn some nights, meals not always logged,
//   weigh-ins ~5/7 days, BP cuff ~3x/week.

export interface GenerateOptions {
	seed?: number
	asOf?: IsoDate
	days?: number
}

export const DEFAULT_SEED = 20261022

const RAMP_DAYS = 42

const CALORIES_PER_MIN: Record<ActivityType, number> = {
	walk: 4.6,
	run: 11,
	cycle: 8.2,
	strength: 6,
	yoga: 3.4,
	swim: 9,
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round = (v: number, step = 1) => {
	const decimals = step < 1 ? Math.round(-Math.log10(step)) : 0
	return Number((Math.round(v / step) * step).toFixed(decimals))
}
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min)

function formatClock(minutesAfterMidnight: number): string {
	const m = ((Math.round(minutesAfterMidnight) % 1440) + 1440) % 1440
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

interface ActivityDraft {
	type: ActivityType
	title: string
	durationMin: number
	distanceKm: number | null
	avgHeartRate: number | null
}

function planActivities(rng: Rng, weekday: number, routine: boolean): ActivityDraft[] {
	const drafts: ActivityDraft[] = []
	const isWeekday = weekday >= 1 && weekday <= 5
	if (routine && isWeekday && chance(rng, 0.68)) {
		const durationMin = round(between(rng, 20, 34))
		drafts.push({
			type: 'walk',
			title: 'Lunchtime walk',
			durationMin,
			distanceKm: round((durationMin / 60) * between(rng, 5, 5.8), 0.1),
			avgHeartRate: round(between(rng, 98, 112)),
		})
	}
	if (weekday === 6 && chance(rng, routine ? 0.75 : 0.55)) {
		const durationMin = round(between(rng, 40, 75), 5)
		drafts.push({
			type: 'cycle',
			title: 'Saturday ride',
			durationMin,
			distanceKm: round((durationMin / 60) * between(rng, 17, 22), 0.1),
			avgHeartRate: round(between(rng, 124, 142)),
		})
	}
	if ((weekday === 2 || weekday === 4) && chance(rng, routine ? 0.35 : 0.2)) {
		drafts.push({
			type: 'strength',
			title: weekday === 2 ? 'Gym: upper body' : 'Gym: legs & core',
			durationMin: round(between(rng, 30, 45), 5),
			distanceKm: null,
			avgHeartRate: round(between(rng, 105, 122)),
		})
	}
	if (weekday === 0 && routine) {
		if (chance(rng, 0.45)) {
			drafts.push({
				type: 'yoga',
				title: 'Sunday yoga',
				durationMin: round(between(rng, 25, 45), 5),
				distanceKm: null,
				avgHeartRate: round(between(rng, 82, 95)),
			})
		} else if (chance(rng, 0.3)) {
			const durationMin = round(between(rng, 25, 40), 5)
			drafts.push({
				type: 'swim',
				title: 'Pool laps',
				durationMin,
				distanceKm: round(durationMin * 0.035, 0.1),
				avgHeartRate: round(between(rng, 122, 136)),
			})
		}
	}
	return drafts
}

function buildSleep(rng: Rng, date: IsoDate, ramp: number): SleepRecord {
	// The record on `date` is the night ending that morning.
	const weekday = dayOfWeek(date)
	// Sat & Sun mornings follow Fri & Sat nights: later to bed, later up.
	const weekend = weekday === 6 || weekday === 0
	const bedtime = (weekend ? 55 : -5) - 15 * ramp + gaussian(rng, 0, 35) // minutes after midnight
	const wake = (weekend ? 495 : 395) + gaussian(rng, 0, 20)
	const late = bedtime > 0
	const awakeMinutes = round(clamp(gaussian(rng, late ? 34 : 24, 8), 8, 70))
	const totalMinutes = round(clamp(wake - bedtime - awakeMinutes, 240, 560))
	const deepMinutes = round(
		totalMinutes * clamp(gaussian(rng, late ? 0.15 : 0.18, 0.02), 0.08, 0.26),
	)
	const remMinutes = round(totalMinutes * clamp(gaussian(rng, 0.22, 0.025), 0.12, 0.3))
	return {
		totalMinutes,
		deepMinutes,
		remMinutes,
		lightMinutes: totalMinutes - deepMinutes - remMinutes,
		awakeMinutes,
		bedtime: formatClock(bedtime),
	}
}

function isLateBedtime(sleep: SleepRecord | null): boolean {
	if (!sleep) return false
	const hour = Number(sleep.bedtime.slice(0, 2))
	return hour < 12 // after midnight
}

/** Pure generator. Same options → identical output. */
export function generateHealthData(options: GenerateOptions = {}): HealthData {
	const seed = options.seed ?? DEFAULT_SEED
	const asOf = options.asOf ?? AS_OF
	const count = options.days ?? DATASET_DAYS
	const rng = mulberry32(seed)

	const days: DailyMetrics[] = []
	const activities: Activity[] = []

	for (let i = 0; i < count; i++) {
		const date = addDays(asOf, i - (count - 1))
		const weekday = dayOfWeek(date)
		const isWeekend = weekday === 0 || weekday === 6
		const sinceRoutine = daysBetween(ROUTINE_START, date)
		const routine = sinceRoutine >= 0
		const ramp = routine ? clamp((sinceRoutine + 1) / RAMP_DAYS, 0, 1) : 0
		const t = i / Math.max(1, count - 1)

		// Activities
		const drafts = planActivities(rng, weekday, routine)
		drafts.forEach((draft, n) => {
			activities.push({
				id: `act-${date}-${n + 1}`,
				date,
				type: draft.type,
				title: draft.title,
				durationMin: draft.durationMin,
				distanceKm: draft.distanceKm,
				caloriesBurned: round(draft.durationMin * CALORIES_PER_MIN[draft.type]),
				avgHeartRate: draft.avgHeartRate,
			})
		})

		// Steps & activity
		const baseSteps = clamp(gaussian(rng, (isWeekend ? 6400 : 5000) + 1200 * ramp, 950), 1800, 14000)
		const walkSteps = drafts
			.filter((d) => d.type === 'walk' || d.type === 'run')
			.reduce((sum, d) => sum + (d.distanceKm ?? 0) * 1350, 0)
		const steps = round(baseSteps + walkSteps)
		const sessionMinutes = drafts.reduce((sum, d) => sum + d.durationMin, 0)
		const activeMinutes = round(
			clamp(gaussian(rng, (baseSteps - 4500) / 350, 3), 0, 25) + sessionMinutes,
		)
		const sessionCalories = drafts.reduce(
			(sum, d) => sum + d.durationMin * CALORIES_PER_MIN[d.type],
			0,
		)
		const caloriesBurned = round(1780 + baseSteps * 0.035 + sessionCalories, 10)

		// Sleep (watch not worn ~5% of nights)
		const sleep = chance(rng, 0.05) ? null : buildSleep(rng, date, ramp)
		const late = isLateBedtime(sleep)

		// Heart
		const restingHeartRate = round(71.5 - 4.5 * ramp + (late ? 1.6 : 0) + gaussian(rng, 0, 1.2))
		const hrvMs = sleep
			? round(clamp(33 + 8 * ramp - (late ? 4 : 0) + gaussian(rng, 0, 4), 18, 70))
			: null

		// Weight (smart scale ~5 days a week)
		const weightTrend = 86.4 - 0.7 * t - 1.9 * ramp
		const weightKg = chance(rng, 0.72) ? round(weightTrend + gaussian(rng, 0, 0.3), 0.1) : null

		// Blood pressure: Mon / Wed / Fri, occasionally skipped
		const bpDay = weekday === 1 || weekday === 3 || weekday === 5
		const bloodPressure =
			bpDay && chance(rng, 0.9)
				? {
						systolic: round(136 - 7 * ramp - 1.5 * t + (late ? 2 : 0) + gaussian(rng, 0, 3.5)),
						diastolic: round(87 - 4 * ramp + gaussian(rng, 0, 2.5)),
					}
				: null

		// Nutrition (logged less reliably at weekends)
		let nutrition: DailyMetrics['nutrition'] = null
		if (chance(rng, isWeekend ? 0.65 : 0.85)) {
			const calories = round(
				clamp(gaussian(rng, 2350 - 220 * ramp + (isWeekend ? 330 : 0), 180), 1500, 3400),
				10,
			)
			const proteinG = round(clamp(gaussian(rng, 83 + 4 * ramp, 12), 45, 160))
			const rest = calories - proteinG * 4
			nutrition = {
				calories,
				proteinG,
				carbsG: round((rest * 0.55) / 4),
				fatG: round((rest * 0.45) / 9),
				waterMl: round(clamp(gaussian(rng, 1550 + 300 * ramp, 260), 800, 3200), 50),
			}
		}

		// Mood (skipped ~15% of days)
		let mood: DailyMetrics['mood'] = null
		if (!chance(rng, 0.15)) {
			const sleepBoost = sleep ? (sleep.totalMinutes >= 420 ? 0.5 : -0.4) : 0
			mood = clamp(
				Math.round(3.1 + sleepBoost + 0.5 * ramp + gaussian(rng, 0, 0.6)),
				1,
				5,
			) as DailyMetrics['mood']
		}

		days.push({
			date,
			steps,
			activeMinutes,
			caloriesBurned,
			restingHeartRate,
			hrvMs,
			sleep,
			nutrition,
			weightKg,
			bloodPressure,
			mood,
		})
	}

	return {
		persona: PERSONA,
		asOf,
		days,
		activities,
		goals: GOALS,
	}
}
