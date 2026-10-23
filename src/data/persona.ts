import type { Goal, Persona } from '../types/health.js'

// Fictional user. The brief referenced a persona and dataset that were not
// attached, so this one is invented to be coherent and realistic.
export const PERSONA: Persona = {
	id: 'daniel-park',
	name: 'Daniel Park',
	age: 38,
	sex: 'male',
	heightCm: 177,
	occupation: 'Project manager (desk job, mostly remote)',
	location: 'Seattle, WA',
	healthContext: [
		'Blood pressure 136/87 at his annual check-up in July 2026; his doctor suggested lifestyle changes and re-checking in three months.',
		'Weighed 86.4 kg at the start of tracking (BMI about 27.6).',
		'Sits 8–9 hours a day. Started a daily lunchtime walking routine on 10 Sep 2026.',
		'Light sleeper who often stays up late on screens, especially on weekends.',
		'Uses a smartwatch, a smart scale, a home BP cuff (about 3 readings a week) and logs most meals.',
	],
	motivation:
		'I want to get my blood pressure back to normal without medication, lose about 5 kg, and stop feeling wiped out every afternoon.',
}

/** Day the walking routine began; the data changes character from here. */
export const ROUTINE_START = '2026-09-10'

/** "Today" for the dataset. Fixed so the data never depends on the clock. */
export const AS_OF = '2026-10-22'

export const DATASET_DAYS = 90

export const GOALS: Goal[] = [
	{
		id: 'goal-steps',
		metric: 'steps',
		label: 'Walk 8,000 steps a day',
		target: 8000,
		unit: 'steps',
		direction: 'atLeast',
		basis: 'avg7',
		baseline: 5600,
		deadline: null,
	},
	{
		id: 'goal-active',
		metric: 'activeMinutes',
		label: '30 active minutes a day',
		target: 30,
		unit: 'min',
		direction: 'atLeast',
		basis: 'avg7',
		baseline: 18,
		deadline: null,
	},
	{
		id: 'goal-sleep',
		metric: 'sleepMinutes',
		label: 'Sleep 7.5 hours a night',
		target: 450,
		unit: 'min',
		direction: 'atLeast',
		basis: 'avg7',
		baseline: 390,
		deadline: null,
	},
	{
		id: 'goal-weight',
		metric: 'weightKg',
		label: 'Reach 81 kg',
		target: 81,
		unit: 'kg',
		direction: 'atMost',
		basis: 'latest',
		baseline: 86.4,
		deadline: '2027-01-31',
	},
	{
		id: 'goal-bp',
		metric: 'systolic',
		label: 'Systolic BP under 125',
		target: 125,
		unit: 'mmHg',
		direction: 'atMost',
		basis: 'avg7',
		baseline: 136,
		deadline: '2026-12-15',
	},
	{
		id: 'goal-protein',
		metric: 'proteinG',
		label: 'Eat 120 g protein a day',
		target: 120,
		unit: 'g',
		direction: 'atLeast',
		basis: 'avg7',
		baseline: 84,
		deadline: null,
	},
]
