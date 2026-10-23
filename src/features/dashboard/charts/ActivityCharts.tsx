import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { averageOf, hasValues } from '../chartData'
import { formatNumber } from '../format'
import ChartFrame from './ChartFrame'
import {
	CHART_CLASS,
	GOAL_LINE_PROPS,
	goalLabel,
	trendTooltip,
	X_AXIS_PROPS,
	Y_AXIS_PROPS,
	type TrendChartProps,
} from './shared'

interface ActivityChartsProps extends TrendChartProps {
	stepsGoal: number | null
	activeGoal: number | null
}

const stepsConfig = { steps: { label: 'Steps', color: 'var(--chart-2)' } } satisfies ChartConfig
const activeConfig = {
	activeMinutes: { label: 'Active minutes', color: 'var(--chart-4)' },
} satisfies ChartConfig

export default function ActivityCharts({
	rows,
	weekly,
	rangeName,
	stepsGoal,
	activeGoal,
}: ActivityChartsProps) {
	const C = DASHBOARD_COPY.trends.charts
	const stepsAvg = averageOf(rows, 'steps')
	const activeAvg = averageOf(rows, 'activeMinutes')
	return (
		<div className="flex flex-col gap-6">
			<ChartFrame
				title={C.steps}
				isEmpty={!hasValues(rows, 'steps')}
				summary={`Avg ${formatNumber(stepsAvg ?? 0)} a day, ${rangeName}${stepsGoal ? ` · goal ${formatNumber(stepsGoal)}` : ''}`}
			>
				<ChartContainer config={stepsConfig} className={CHART_CLASS}>
					<BarChart data={rows} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis {...X_AXIS_PROPS} />
						<YAxis {...Y_AXIS_PROPS} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
						{trendTooltip(weekly)}
						<Bar
							isAnimationActive={false}
							dataKey="steps"
							fill="var(--color-steps)"
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
						/>
						{stepsGoal !== null && (
							<ReferenceLine
								y={stepsGoal}
								{...GOAL_LINE_PROPS}
								label={goalLabel(formatNumber(stepsGoal))}
							/>
						)}
					</BarChart>
				</ChartContainer>
			</ChartFrame>
			<ChartFrame
				title={C.activeMinutes}
				isEmpty={!hasValues(rows, 'activeMinutes')}
				summary={`Avg ${formatNumber(activeAvg ?? 0)} min a day, ${rangeName}`}
			>
				<ChartContainer config={activeConfig} className={CHART_CLASS}>
					<BarChart data={rows} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis {...X_AXIS_PROPS} />
						<YAxis {...Y_AXIS_PROPS} />
						{trendTooltip(weekly)}
						<Bar
							isAnimationActive={false}
							dataKey="activeMinutes"
							fill="var(--color-activeMinutes)"
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
						/>
						{activeGoal !== null && (
							<ReferenceLine y={activeGoal} {...GOAL_LINE_PROPS} label={goalLabel(`${activeGoal} min`)} />
						)}
					</BarChart>
				</ChartContainer>
			</ChartFrame>
		</div>
	)
}
