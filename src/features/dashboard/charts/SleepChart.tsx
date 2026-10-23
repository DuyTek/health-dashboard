import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { averageOf, hasValues } from '../chartData'
import { formatHoursMinutes } from '../format'
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

interface SleepChartProps extends TrendChartProps {
	/** Sleep goal in minutes. */
	sleepGoal: number | null
}

// Deep is darkest: it's the stage people usually care most about.
const sleepConfig = {
	deepH: { label: 'Deep (h)', color: 'var(--chart-3)' },
	remH: { label: 'REM (h)', color: 'var(--chart-2)' },
	lightH: { label: 'Light (h)', color: 'var(--chart-1)' },
} satisfies ChartConfig

export default function SleepChart({ rows, weekly, rangeName, sleepGoal }: SleepChartProps) {
	const avg = averageOf(rows, 'sleepH')
	const deep = averageOf(rows, 'deepH')
	return (
		<ChartFrame
			title={DASHBOARD_COPY.trends.charts.sleepStages}
			isEmpty={!hasValues(rows, 'sleepH')}
			summary={`Avg ${formatHoursMinutes((avg ?? 0) * 60)} a night (${formatHoursMinutes((deep ?? 0) * 60)} deep), ${rangeName}`}
		>
			<ChartContainer config={sleepConfig} className={CHART_CLASS}>
				<BarChart data={rows} accessibilityLayer>
					<CartesianGrid vertical={false} />
					<XAxis {...X_AXIS_PROPS} />
					<YAxis {...Y_AXIS_PROPS} tickFormatter={(v: number) => `${v}h`} />
					{trendTooltip(weekly)}
					<ChartLegend content={<ChartLegendContent />} />
					<Bar
						isAnimationActive={false}
						dataKey="deepH"
						stackId="sleep"
						fill="var(--color-deepH)"
						maxBarSize={28}
					/>
					<Bar
						isAnimationActive={false}
						dataKey="remH"
						stackId="sleep"
						fill="var(--color-remH)"
						maxBarSize={28}
					/>
					<Bar
						isAnimationActive={false}
						dataKey="lightH"
						stackId="sleep"
						fill="var(--color-lightH)"
						radius={[4, 4, 0, 0]}
						maxBarSize={28}
					/>
					{sleepGoal !== null && (
						<ReferenceLine
							y={sleepGoal / 60}
							{...GOAL_LINE_PROPS}
							label={goalLabel(formatHoursMinutes(sleepGoal))}
						/>
					)}
				</BarChart>
			</ChartContainer>
		</ChartFrame>
	)
}
