import { ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import type { TrendRow } from '../chartData'

// Shared chart props so every trend chart looks and behaves the same.

export interface TrendChartProps {
	rows: TrendRow[]
	weekly: boolean
	/** Human-readable range, e.g. "last 30 days". */
	rangeName: string
}

export const CHART_CLASS = 'aspect-auto h-52 w-full sm:h-60'

export const X_AXIS_PROPS = {
	dataKey: 'label',
	tickLine: false,
	axisLine: false,
	tickMargin: 8,
	minTickGap: 24,
} as const

export const Y_AXIS_PROPS = {
	tickLine: false,
	axisLine: false,
	width: 40,
	tickMargin: 4,
} as const

export const GOAL_LINE_PROPS = {
	stroke: 'var(--muted-foreground)',
	strokeDasharray: '4 4',
	ifOverflow: 'extendDomain',
} as const

export function goalLabel(value: string) {
	return {
		value: `${DASHBOARD_COPY.trends.goalLine} ${value}`,
		position: 'insideTopRight' as const,
		fill: 'var(--muted-foreground)',
		fontSize: 11,
	}
}

/** Called inline (not as a component) so Recharts sees the Tooltip element directly. */
export function trendTooltip(weekly: boolean) {
	return (
		<ChartTooltip
			cursor={false}
			content={
				<ChartTooltipContent
					labelFormatter={(label) => (weekly ? `Week of ${String(label)}` : String(label))}
				/>
			}
		/>
	)
}
