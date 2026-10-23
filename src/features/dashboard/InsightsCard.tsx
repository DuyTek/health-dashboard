import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types/health'

interface InsightsCardProps {
	insights: Insight[]
}

/** Warnings sort first, so the collapsed view always keeps what needs attention. */
const COLLAPSED_COUNT = 5

const SEVERITY_STYLE = {
	warning: { icon: TriangleAlert, className: 'text-amber-600 dark:text-amber-400' },
	positive: { icon: CircleCheck, className: 'text-emerald-600 dark:text-emerald-400' },
	info: { icon: Info, className: 'text-muted-foreground' },
} as const

export default function InsightsCard({ insights }: InsightsCardProps) {
	const C = DASHBOARD_COPY.insights
	const [expanded, setExpanded] = useState(false)
	const visible = expanded ? insights : insights.slice(0, COLLAPSED_COUNT)
	const canToggle = insights.length > COLLAPSED_COUNT
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{C.title}</h2>
				</CardTitle>
				<CardDescription>{C.description}</CardDescription>
			</CardHeader>
			<CardContent>
				{insights.length === 0 ? (
					<p className="text-sm text-muted-foreground">{C.empty}</p>
				) : (
					<ul className="flex flex-col gap-4">
						{visible.map((insight) => {
							const { icon: Icon, className } = SEVERITY_STYLE[insight.severity]
							return (
								<li key={insight.id} className="flex gap-3">
									<Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', className)} />
									<div className="flex flex-col gap-0.5">
										<p className="text-sm font-medium">
											<span className="sr-only">{C.severity[insight.severity]}: </span>
											{insight.title}
										</p>
										<p className="text-sm text-muted-foreground">{insight.detail}</p>
									</div>
								</li>
							)
						})}
					</ul>
				)}
				{canToggle && (
					<Button
						variant="ghost"
						size="sm"
						className="mt-3 -ml-2"
						aria-expanded={expanded}
						onClick={() => setExpanded((v) => !v)}
					>
						{expanded ? C.showLess : C.showAll(insights.length)}
					</Button>
				)}
			</CardContent>
		</Card>
	)
}
