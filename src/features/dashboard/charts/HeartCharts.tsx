import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { averageOf, hasValues } from '../chartData'
import { formatNumber } from '../format'
import ChartFrame from './ChartFrame'
import {
	GOAL_LINE_PROPS,
	goalLabel,
	trendTooltip,
	X_AXIS_PROPS,
	Y_AXIS_PROPS,
	type TrendChartProps,
} from './shared'

interface HeartChartsProps extends TrendChartProps {
	systolicGoal: number | null
}

const rhrConfig = {
	rhr: { label: 'Resting HR (bpm)', color: 'var(--chart-4)' },
} satisfies ChartConfig
const hrvConfig = { hrv: { label: 'HRV (ms)', color: 'var(--chart-2)' } } satisfies ChartConfig
const bpConfig = {
	systolic: { label: 'Systolic', color: 'var(--chart-5)' },
	diastolic: { label: 'Diastolic', color: 'var(--chart-2)' },
} satisfies ChartConfig

const SMALL_CHART = 'aspect-auto h-40 w-full sm:h-44'
const LINE = { type: 'monotone', strokeWidth: 2, dot: false, connectNulls: true } as const

// RHR and HRV are separate small charts rather than one dual-axis chart: they
// have different units, and a second y-axis invites false correlations.
export default function HeartCharts({ rows, weekly, rangeName, systolicGoal }: HeartChartsProps) {
	const C = DASHBOARD_COPY.trends.charts
	const rhr = averageOf(rows, 'rhr')
	const hrv = averageOf(rows, 'hrv')
	const sys = averageOf(rows, 'systolic')
	const dia = averageOf(rows, 'diastolic')
	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-6 sm:grid-cols-2">
				<ChartFrame
					title={C.restingHeartRate}
					isEmpty={!hasValues(rows, 'rhr')}
					summary={`Avg ${formatNumber(rhr ?? 0, 1)} bpm, ${rangeName}`}
				>
					<ChartContainer config={rhrConfig} className={SMALL_CHART}>
						<LineChart data={rows} accessibilityLayer>
							<CartesianGrid vertical={false} />
							<XAxis {...X_AXIS_PROPS} />
							<YAxis {...Y_AXIS_PROPS} domain={['dataMin - 2', 'dataMax + 2']} />
							{trendTooltip(weekly)}
							<Line isAnimationActive={false} dataKey="rhr" stroke="var(--color-rhr)" {...LINE} />
						</LineChart>
					</ChartContainer>
				</ChartFrame>
				<ChartFrame
					title={C.hrv}
					isEmpty={!hasValues(rows, 'hrv')}
					summary={`Avg ${formatNumber(hrv ?? 0, 1)} ms, ${rangeName}`}
				>
					<ChartContainer config={hrvConfig} className={SMALL_CHART}>
						<LineChart data={rows} accessibilityLayer>
							<CartesianGrid vertical={false} />
							<XAxis {...X_AXIS_PROPS} />
							<YAxis {...Y_AXIS_PROPS} domain={['dataMin - 4', 'dataMax + 4']} />
							{trendTooltip(weekly)}
							<Line isAnimationActive={false} dataKey="hrv" stroke="var(--color-hrv)" {...LINE} />
						</LineChart>
					</ChartContainer>
				</ChartFrame>
			</div>
			<ChartFrame
				title={C.bloodPressure}
				isEmpty={!hasValues(rows, 'systolic', 'diastolic')}
				summary={`Avg ${formatNumber(sys ?? 0)}/${formatNumber(dia ?? 0)} mmHg, ${rangeName}`}
			>
				<ChartContainer config={bpConfig} className="aspect-auto h-52 w-full sm:h-60">
					<LineChart data={rows} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis {...X_AXIS_PROPS} />
						<YAxis {...Y_AXIS_PROPS} domain={['dataMin - 6', 'dataMax + 6']} />
						{trendTooltip(weekly)}
						<ChartLegend content={<ChartLegendContent />} />
						<Line
							isAnimationActive={false}
							dataKey="systolic"
							stroke="var(--color-systolic)"
							{...LINE}
							dot={{ r: 2.5, fill: 'var(--color-systolic)' }}
						/>
						<Line
							isAnimationActive={false}
							dataKey="diastolic"
							stroke="var(--color-diastolic)"
							{...LINE}
							strokeDasharray="5 3"
							dot={{ r: 2.5, fill: 'var(--color-diastolic)' }}
						/>
						{systolicGoal !== null && (
							<ReferenceLine
								y={systolicGoal}
								{...GOAL_LINE_PROPS}
								label={goalLabel(`${systolicGoal} sys`)}
							/>
						)}
					</LineChart>
				</ChartContainer>
			</ChartFrame>
		</div>
	)
}
