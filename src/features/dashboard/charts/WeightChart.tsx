import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { hasValues } from '../chartData'
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

interface WeightChartProps extends TrendChartProps {
	weightGoal: number | null
}

const weightConfig = {
	weight: { label: 'Weight (kg)', color: 'var(--chart-4)' },
} satisfies ChartConfig

export default function WeightChart({ rows, weekly, rangeName, weightGoal }: WeightChartProps) {
	const readings = rows.filter((r) => r.weight !== null)
	const first = readings[0]?.weight ?? null
	const last = readings.at(-1)?.weight ?? null
	const summary =
		first !== null && last !== null
			? `${formatNumber(first, 1)} → ${formatNumber(last, 1)} kg (${last - first <= 0 ? '−' : '+'}${formatNumber(Math.abs(last - first), 1)} kg), ${rangeName}`
			: ''
	return (
		<ChartFrame
			title={DASHBOARD_COPY.trends.charts.weight}
			isEmpty={!hasValues(rows, 'weight')}
			summary={summary}
		>
			<ChartContainer config={weightConfig} className={CHART_CLASS}>
				<LineChart data={rows} accessibilityLayer>
					<CartesianGrid vertical={false} />
					<XAxis {...X_AXIS_PROPS} />
					<YAxis {...Y_AXIS_PROPS} domain={['dataMin - 1', 'dataMax + 1']} />
					{trendTooltip(weekly)}
					<Line
						isAnimationActive={false}
						dataKey="weight"
						type="monotone"
						stroke="var(--color-weight)"
						strokeWidth={2}
						connectNulls
						dot={{ r: 2.5, fill: 'var(--color-weight)' }}
					/>
					{weightGoal !== null && (
						<ReferenceLine y={weightGoal} {...GOAL_LINE_PROPS} label={goalLabel(`${weightGoal} kg`)} />
					)}
				</LineChart>
			</ChartContainer>
		</ChartFrame>
	)
}
