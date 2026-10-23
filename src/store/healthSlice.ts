import { createSlice } from '@reduxjs/toolkit'

// STUB (Phase 0). Owned by feat/health-data-dashboard.
export interface HealthState {
	status: 'idle' | 'loading' | 'succeeded' | 'failed'
}

const initialState: HealthState = { status: 'idle' }

const healthSlice = createSlice({
	name: 'health',
	initialState,
	reducers: {},
})

export default healthSlice.reducer
