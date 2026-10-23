import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { getHealthData } from '@/data'
import type { LoadHealthDataArgs } from '@/store/healthSlice'
import { renderWithStore } from '@/test/render'
import type { HealthData } from '@/types/health'
import Dashboard from './Dashboard'

const instant = (source?: LoadHealthDataArgs['source']): LoadHealthDataArgs => ({
	delayMs: 0,
	source,
})

describe('Dashboard', () => {
	it('shows a skeleton while loading, then the dashboard', async () => {
		renderWithStore(<Dashboard loadArgs={instant()} />)
		expect(screen.getByRole('status')).toHaveTextContent(DASHBOARD_COPY.loadingLabel)

		expect(await screen.findByRole('heading', { name: 'Hi Daniel' })).toBeInTheDocument()
		expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
		expect(screen.getByText(/Your health as of Thursday, October 22, 2026/)).toBeInTheDocument()

		const glance = screen.getByRole('region', { name: DASHBOARD_COPY.glance.title })
		for (const label of Object.values(DASHBOARD_COPY.glance.labels)) {
			expect(within(glance).getByText(label)).toBeInTheDocument()
		}
		expect(screen.getByRole('heading', { name: DASHBOARD_COPY.goals.title })).toBeInTheDocument()
		expect(screen.getByText('Walk 8,000 steps a day')).toBeInTheDocument()
		expect(screen.getByText(/Protein is averaging/)).toBeInTheDocument()
		expect(screen.getByRole('heading', { name: DASHBOARD_COPY.activities.title })).toBeInTheDocument()
		expect(
			screen.getByRole('figure', { name: DASHBOARD_COPY.trends.charts.steps }),
		).toBeInTheDocument()
	})

	it('shows an error with a working retry', async () => {
		let calls = 0
		const flaky = () => {
			calls++
			if (calls === 1) throw new Error('Network unavailable')
			return getHealthData()
		}
		renderWithStore(<Dashboard loadArgs={instant(flaky)} />)

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent(DASHBOARD_COPY.error.title)
		expect(alert).toHaveTextContent('Network unavailable')

		await userEvent.click(within(alert).getByRole('button', { name: DASHBOARD_COPY.error.retry }))
		expect(await screen.findByRole('heading', { name: 'Hi Daniel' })).toBeInTheDocument()
		expect(calls).toBe(2)
	})

	it('shows an empty state when there is no data', async () => {
		const empty: HealthData = { ...getHealthData(), days: [], activities: [] }
		renderWithStore(<Dashboard loadArgs={instant(() => empty)} />)
		expect(await screen.findByText(DASHBOARD_COPY.empty.title)).toBeInTheDocument()
	})

	it('switches the trend range and aggregates weekly at 90 days', async () => {
		const { store } = renderWithStore(<Dashboard loadArgs={instant()} />)
		await screen.findByRole('heading', { name: 'Hi Daniel' })
		expect(screen.getAllByText(/last 30 days/, { selector: 'figcaption' }).length).toBeGreaterThan(0)

		await userEvent.click(screen.getByRole('radio', { name: 'last 90 days' }))
		expect(store.getState().health.range).toBe(90)
		expect(screen.getByRole('radio', { name: 'last 90 days' })).toHaveAttribute(
			'aria-checked',
			'true',
		)
		expect(screen.getByText(new RegExp(DASHBOARD_COPY.trends.weeklyNote))).toBeInTheDocument()

		await userEvent.click(screen.getByRole('radio', { name: 'last 7 days' }))
		expect(store.getState().health.range).toBe(7)
		expect(screen.queryByText(new RegExp(DASHBOARD_COPY.trends.weeklyNote))).not.toBeInTheDocument()
	})

	it('shows empty chart and list states when a metric has no data', async () => {
		const base = getHealthData()
		const noSleep: HealthData = {
			...base,
			days: base.days.map((d) => ({ ...d, sleep: null, hrvMs: null })),
			activities: [],
		}
		renderWithStore(<Dashboard loadArgs={instant(() => noSleep)} />)
		await screen.findByRole('heading', { name: 'Hi Daniel' })
		expect(screen.getByText(DASHBOARD_COPY.activities.empty)).toBeInTheDocument()

		await userEvent.click(screen.getByRole('tab', { name: DASHBOARD_COPY.trends.tabs.sleep }))
		const figure = screen.getByRole('figure', { name: DASHBOARD_COPY.trends.charts.sleepStages })
		expect(within(figure).getByText(DASHBOARD_COPY.trends.emptyChart)).toBeInTheDocument()
	})
})
