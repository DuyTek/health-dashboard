import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import type { HealthSummary } from '@/types/health'
import { formatLongDate, formatMediumDate } from './format'

interface DashboardHeaderProps {
	summary: HealthSummary
}

export default function DashboardHeader({ summary }: DashboardHeaderProps) {
	const { persona } = summary
	const firstName = persona.name.split(' ')[0]
	return (
		<header className="flex flex-col gap-1">
			<h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
				{DASHBOARD_COPY.greeting(firstName)}
			</h1>
			<p className="text-sm text-muted-foreground">
				{DASHBOARD_COPY.asOf(formatLongDate(summary.asOf))}
				<span aria-hidden="true"> · </span>
				{DASHBOARD_COPY.trackingSince(formatMediumDate(summary.periodStart))}
			</p>
			<p className="max-w-2xl text-sm text-pretty text-muted-foreground italic">
				“{persona.motivation}”
			</p>
		</header>
	)
}
