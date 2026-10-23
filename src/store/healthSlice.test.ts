import { makeStore } from '@/store'
import {
	loadHealthData,
	selectHealthData,
	selectHealthError,
	selectHealthStatus,
	selectHealthSummary,
	selectRange,
	setRange,
} from './healthSlice'

describe('healthSlice', () => {
	it('starts idle with a 30-day range', () => {
		const store = makeStore()
		expect(selectHealthStatus(store.getState())).toBe('idle')
		expect(selectRange(store.getState())).toBe(30)
		expect(selectHealthSummary(store.getState())).toBeNull()
	})

	it('goes loading → succeeded with data and summary', async () => {
		const store = makeStore()
		const pending = store.dispatch(loadHealthData({ delayMs: 0 }))
		expect(selectHealthStatus(store.getState())).toBe('loading')
		await pending
		const state = store.getState()
		expect(selectHealthStatus(state)).toBe('succeeded')
		expect(selectHealthData(state)?.days).toHaveLength(90)
		expect(selectHealthSummary(state)?.persona.name).toBe('Daniel Park')
		expect(selectHealthError(state)).toBeNull()
	})

	it('waits for the simulated delay', async () => {
		vi.useFakeTimers()
		try {
			const store = makeStore()
			const pending = store.dispatch(loadHealthData({ delayMs: 500 }))
			await vi.advanceTimersByTimeAsync(499)
			expect(selectHealthStatus(store.getState())).toBe('loading')
			await vi.advanceTimersByTimeAsync(1)
			await pending
			expect(selectHealthStatus(store.getState())).toBe('succeeded')
		} finally {
			vi.useRealTimers()
		}
	})

	it('records a failure and clears it on retry', async () => {
		const store = makeStore()
		await store.dispatch(
			loadHealthData({
				delayMs: 0,
				source: () => {
					throw new Error('Network down')
				},
			}),
		)
		expect(selectHealthStatus(store.getState())).toBe('failed')
		expect(selectHealthError(store.getState())).toBe('Network down')

		const retry = store.dispatch(loadHealthData({ delayMs: 0 }))
		expect(selectHealthError(store.getState())).toBeNull()
		await retry
		expect(selectHealthStatus(store.getState())).toBe('succeeded')
	})

	it('changes the chart range', () => {
		const store = makeStore()
		store.dispatch(setRange(90))
		expect(selectRange(store.getState())).toBe(90)
	})
})
