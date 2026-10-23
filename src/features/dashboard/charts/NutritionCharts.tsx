import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from '@/components/ui/chart'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { averageOf, hasValues, type TrendRow } from '../chartData'
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

interface NutritionChartsProps extends TrendChartProps {
	proteinGoal: number | null
}

const caloriesConfig = {
	proteinKcal: { label: 'Protein (kcal)', color: 'var(--chart-5)' },
	carbsKcal: { label: 'Carbs (kcal)', color: 'var(--chart-3)' },
	fatKcal: { label: 'Fat (kcal)', color: 'var(--chart-1)' },
} satisfies ChartConfig
const proteinConfig = {
	proteinG: { label: 'Protein (g)', color: 'var(--chart-4)' },
} satisfies ChartConfig

const totalKcal = (r: TrendRow) =>
	r.proteinKcal === null ? null : (r.proteinKcal ?? 0) + (r.carbsKcal ?? 0) + (r.fatKcal ?? 0)

export default function NutritionCharts({
	rows,
	weekly,
	rangeName,
	proteinGoal,
}: NutritionChartsProps) {
	const C = DASHBOARD_COPY.trends.charts
	const kcal = rows.map(totalKcal).filter((v): v is number => v !== null)
	const kcalAvg = kcal.length ? kcal.reduce((a, b) => a + b, 0) / kcal.length : 0
	const protein = averageOf(rows, 'proteinG')
	return (
		<div className="flex flex-col gap-6">
			<ChartFrame
				title={C.protein}
				isEmpty={!hasValues(rows, 'proteinG')}
				summary={`Avg ${formatNumber(protein ?? 0)} g a day, ${rangeName}${proteinGoal ? ` · goal ${proteinGoal} g` : ''}`}
			>
				<ChartContainer config={proteinConfig} className={CHART_CLASS}>
					<BarChart data={rows} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis {...X_AXIS_PROPS} />
						<YAxis {...Y_AXIS_PROPS} />
						{trendTooltip(weekly)}
						<Bar
							isAnimationActive={false}
							dataKey="proteinG"
							fill="var(--color-proteinG)"
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
						/>
						{proteinGoal !== null && (
							<ReferenceLine y={proteinGoal} {...GOAL_LINE_PROPS} label={goalLabel(`${proteinGoal} g`)} />
						)}
					</BarChart>
				</ChartContainer>
			</ChartFrame>
			<ChartFrame
				title={C.calories}
				isEmpty={kcal.length === 0}
				summary={`Avg ${formatNumber(kcalAvg)} kcal on logged days, ${rangeName}`}
			>
				<ChartContainer config={caloriesConfig} className={CHART_CLASS}>
					<BarChart data={rows} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis {...X_AXIS_PROPS} />
						<YAxis {...Y_AXIS_PROPS} />
						{trendTooltip(weekly)}
						<ChartLegend content={<ChartLegendContent />} />
						<Bar
							isAnimationActive={false}
							dataKey="proteinKcal"
							stackId="kcal"
							fill="var(--color-proteinKcal)"
							maxBarSize={28}
						/>
						<Bar
							isAnimationActive={false}
							dataKey="carbsKcal"
							stackId="kcal"
							fill="var(--color-carbsKcal)"
							maxBarSize={28}
						/>
						<Bar
							isAnimationActive={false}
							dataKey="fatKcal"
							stackId="kcal"
							fill="var(--color-fatKcal)"
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
						/>
					</BarChart>
				</ChartContainer>
			</ChartFrame>
		</div>
	)
}
