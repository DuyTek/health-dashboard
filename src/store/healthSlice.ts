import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { getHealthData } from '@/data'
import { buildHealthSummary } from '@/lib/health'
import type { RangeDays } from '@/lib/health'
import type { HealthData, HealthSummary } from '@/types/health'

export type HealthStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

export interface HealthState {
	status: HealthStatus
	data: HealthData | null
	summary: HealthSummary | null
	error: string | null
	range: RangeDays
}

const initialState: HealthState = {
	status: 'idle',
	data: null,
	summary: null,
	error: null,
	range: 30,
}

/** Simulated network latency. Tests set it to 0. */
export const SIMULATED_DELAY_MS = 600

export interface LoadHealthDataArgs {
	delayMs?: number
	/** Data source; defaults to the seeded dataset. Injectable for tests. */
	source?: () => HealthData | Promise<HealthData>
}

/**
 * Simulates fetching the user's data from an API. There is no backend for
 * health data (it's a seeded fixture), but the UI is built as if there were,
 * so loading and error states are real code paths.
 */
export const loadHealthData = createAsyncThunk<
	{ data: HealthData; summary: HealthSummary },
	LoadHealthDataArgs | undefined,
	{ rejectValue: string }
>('health/load', async (args, { rejectWithValue }) => {
	const delayMs = args?.delayMs ?? SIMULATED_DELAY_MS
	const source = args?.source ?? getHealthData
	try {
		if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
		const data = await source()
		return { data, summary: buildHealthSummary(data) }
	} catch (err) {
		return rejectWithValue(err instanceof Error ? err.message : 'Unknown error')
	}
})

const healthSlice = createSlice({
	name: 'health',
	initialState,
	reducers: {
		setRange(state, action: PayloadAction<RangeDays>) {
			state.range = action.payload
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(loadHealthData.pending, (state) => {
				state.status = 'loading'
				state.error = null
			})
			.addCase(loadHealthData.fulfilled, (state, action) => {
				state.status = 'succeeded'
				state.data = action.payload.data
				state.summary = action.payload.summary
			})
			.addCase(loadHealthData.rejected, (state, action) => {
				state.status = 'failed'
				state.error = action.payload ?? action.error.message ?? 'Unknown error'
			})
	},
})

export const { setRange } = healthSlice.actions

interface WithHealth {
	health: HealthState
}

export const selectHealthStatus = (state: WithHealth) => state.health.status
export const selectHealthError = (state: WithHealth) => state.health.error
export const selectHealthData = (state: WithHealth) => state.health.data
export const selectHealthSummary = (state: WithHealth) => state.health.summary
export const selectRange = (state: WithHealth) => state.health.range

export default healthSlice.reducer
