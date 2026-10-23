import { useCallback, useEffect } from 'react'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { useAppDispatch, useAppSelector } from '@/store'
import {
	loadHealthData,
	selectHealthData,
	selectHealthError,
	selectHealthStatus,
	selectHealthSummary,
	type LoadHealthDataArgs,
} from '@/store/healthSlice'
import DashboardEmpty from './DashboardEmpty'
import DashboardError from './DashboardError'
import DashboardHeader from './DashboardHeader'
import DashboardSkeleton from './DashboardSkeleton'
import GoalsCard from './GoalsCard'
import InsightsCard from './InsightsCard'
import RecentActivities from './RecentActivities'
import TodayGlance from './TodayGlance'
import TrendsCard from './TrendsCard'

interface DashboardProps {
	/** Overrides for the simulated fetch (tests pass `{ delayMs: 0 }`). */
	loadArgs?: LoadHealthDataArgs
}

export default function Dashboard({ loadArgs }: DashboardProps) {
	const dispatch = useAppDispatch()
	const status = useAppSelector(selectHealthStatus)
	const error = useAppSelector(selectHealthError)
	const data = useAppSelector(selectHealthData)
	const summary = useAppSelector(selectHealthSummary)

	const load = useCallback(() => {
		void dispatch(loadHealthData(loadArgs))
	}, [dispatch, loadArgs])

	useEffect(() => {
		if (status === 'idle') load()
	}, [status, load])

	if (status === 'idle' || status === 'loading') {
		return (
			<section aria-label={DASHBOARD_COPY.regionLabel} aria-busy="true">
				<DashboardSkeleton />
			</section>
		)
	}

	if (status === 'failed' || !data || !summary) {
		return (
			<section aria-label={DASHBOARD_COPY.regionLabel}>
				<DashboardError message={error} onRetry={load} />
			</section>
		)
	}

	if (data.days.length === 0) {
		return (
			<section aria-label={DASHBOARD_COPY.regionLabel} className="flex flex-col gap-6">
				<DashboardHeader summary={summary} />
				<DashboardEmpty />
			</section>
		)
	}

	return (
		<section aria-label={DASHBOARD_COPY.regionLabel} className="flex flex-col gap-6">
			<DashboardHeader summary={summary} />
			<TodayGlance summary={summary} />
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Insights and goals come first on mobile; they sit in the right rail on desktop. */}
				<div className="flex flex-col gap-6 lg:order-2">
					<InsightsCard insights={summary.insights} />
					<GoalsCard goals={summary.goals} goalDefs={data.goals} />
				</div>
				<div className="flex min-w-0 flex-col gap-6 lg:order-1 lg:col-span-2">
					<TrendsCard data={data} />
					<RecentActivities
						activities={summary.recentActivities}
						totals={summary.activityTotals.last7}
					/>
				</div>
			</div>
		</section>
	)
}
