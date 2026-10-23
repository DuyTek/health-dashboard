import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { cn } from '@/lib/utils'
import type { Goal, GoalProgress, MetricKey } from '@/types/health'
import { formatHoursMinutes, formatNumber } from './format'

interface GoalsCardProps {
	goals: GoalProgress[]
	goalDefs: Goal[]
}

const STATUS_CLASS: Record<GoalProgress['status'], string> = {
	achieved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
	'on-track': 'bg-secondary text-secondary-foreground',
	behind: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
	'no-data': 'border-border text-muted-foreground',
}

function formatGoalValue(metric: MetricKey, value: number, unit: string): string {
	if (metric === 'sleepMinutes') return formatHoursMinutes(value)
	const decimals = metric === 'weightKg' ? 1 : 0
	return `${formatNumber(value, decimals)} ${unit}`
}

export default function GoalsCard({ goals, goalDefs }: GoalsCardProps) {
	const C = DASHBOARD_COPY.goals
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{C.title}</h2>
				</CardTitle>
				<CardDescription>{C.description}</CardDescription>
			</CardHeader>
			<CardContent>
				{goals.length === 0 ? (
					<p className="text-sm text-muted-foreground">{C.empty}</p>
				) : (
					<ul className="flex flex-col gap-4">
						{goals.map((goal) => {
							const def = goalDefs.find((g) => g.id === goal.goalId)
							const labelId = `goal-${goal.goalId}`
							return (
								<li key={goal.goalId} className="flex flex-col gap-1.5">
									<div className="flex items-center justify-between gap-2">
										<span id={labelId} className="text-sm font-medium">
											{goal.label}
										</span>
										<Badge variant="outline" className={cn('border-transparent', STATUS_CLASS[goal.status])}>
											{C.status[goal.status]}
										</Badge>
									</div>
									<Progress
										value={goal.progressPct}
										aria-labelledby={labelId}
										aria-valuetext={`${goal.progressPct}% of the way from ${formatGoalValue(goal.metric, goal.baseline, goal.unit)} to ${formatGoalValue(goal.metric, goal.target, goal.unit)}`}
										className={cn(goal.status === 'achieved' && '[&>*]:bg-emerald-600')}
									/>
									<p className="text-xs text-muted-foreground tabular-nums">
										{C.current}{' '}
										<span className="font-medium text-foreground">
											{goal.current === null ? '—' : formatGoalValue(goal.metric, goal.current, goal.unit)}
										</span>
										{def && <> ({C.basis[def.basis]})</>}
										<span aria-hidden="true"> · </span>
										{C.target} {formatGoalValue(goal.metric, goal.target, goal.unit)}
									</p>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
