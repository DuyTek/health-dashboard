import { Bike, Dumbbell, Flower2, Footprints, PersonStanding, Waves } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import type { Activity, ActivityType } from '@/types/health'
import { formatNumber, formatWeekdayDate } from './format'

interface RecentActivitiesProps {
	activities: Activity[]
	totals: { sessions: number; minutes: number }
}

const ICONS: Record<ActivityType, ComponentType<SVGProps<SVGSVGElement>>> = {
	walk: Footprints,
	run: PersonStanding,
	cycle: Bike,
	strength: Dumbbell,
	yoga: Flower2,
	swim: Waves,
}

export default function RecentActivities({ activities, totals }: RecentActivitiesProps) {
	const C = DASHBOARD_COPY.activities
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{C.title}</h2>
				</CardTitle>
				<CardDescription>{C.description(totals.sessions, totals.minutes)}</CardDescription>
			</CardHeader>
			<CardContent>
				{activities.length === 0 ? (
					<p className="text-sm text-muted-foreground">{C.empty}</p>
				) : (
					<ul className="divide-y">
						{activities.map((a) => {
							const Icon = ICONS[a.type]
							const details = [
								`${a.durationMin} min`,
								a.distanceKm !== null ? `${formatNumber(a.distanceKm, 1)} km` : null,
								`${formatNumber(a.caloriesBurned)} kcal`,
								a.avgHeartRate !== null ? C.avgHr(a.avgHeartRate) : null,
							].filter(Boolean)
							return (
								<li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
										<Icon aria-hidden="true" className="size-4" />
										<span className="sr-only">{C.types[a.type]}</span>
									</span>
									<div className="flex min-w-0 flex-1 flex-col">
										<span className="truncate text-sm font-medium">{a.title}</span>
										<span className="text-xs text-muted-foreground tabular-nums">{details.join(' · ')}</span>
									</div>
									<time dateTime={a.date} className="shrink-0 text-xs text-muted-foreground">
										{formatWeekdayDate(a.date)}
									</time>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
