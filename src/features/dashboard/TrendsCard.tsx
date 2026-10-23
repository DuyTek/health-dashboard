import { useMemo } from 'react'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import type { RangeDays } from '@/lib/health'
import { useAppDispatch, useAppSelector } from '@/store'
import { selectRange, setRange } from '@/store/healthSlice'
import type { HealthData, MetricKey } from '@/types/health'
import { buildTrendData } from './chartData'
import ActivityCharts from './charts/ActivityCharts'
import HeartCharts from './charts/HeartCharts'
import NutritionCharts from './charts/NutritionCharts'
import SleepChart from './charts/SleepChart'
import WeightChart from './charts/WeightChart'

interface TrendsCardProps {
	data: HealthData
}

const RANGES: RangeDays[] = [7, 30, 90]

const isRange = (value: string): value is `${RangeDays}` => ['7', '30', '90'].includes(value)

export default function TrendsCard({ data }: TrendsCardProps) {
	const C = DASHBOARD_COPY.trends
	const dispatch = useAppDispatch()
	const range = useAppSelector(selectRange)
	const { rows, weekly } = useMemo(() => buildTrendData(data, range), [data, range])

	const goalFor = (metric: MetricKey) => data.goals.find((g) => g.metric === metric)?.target ?? null
	const rangeName = C.rangeNames[range]
	const common = { rows, weekly, rangeName }

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{C.title}</h2>
				</CardTitle>
				<CardDescription>
					{C.description}
					{weekly && <> · {C.weeklyNote}</>}
				</CardDescription>
				<CardAction>
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						spacing={0}
						value={String(range)}
						onValueChange={(value) => {
							if (isRange(value)) dispatch(setRange(Number(value) as RangeDays))
						}}
						aria-label={C.rangeLabel}
					>
						{RANGES.map((r) => (
							<ToggleGroupItem key={r} value={String(r)} aria-label={C.rangeNames[r]}>
								{C.ranges[r]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="activity">
					<div className="-mx-1 overflow-x-auto px-1 pb-1">
						<TabsList>
							<TabsTrigger value="activity">{C.tabs.activity}</TabsTrigger>
							<TabsTrigger value="sleep">{C.tabs.sleep}</TabsTrigger>
							<TabsTrigger value="heart">{C.tabs.heart}</TabsTrigger>
							<TabsTrigger value="body">{C.tabs.body}</TabsTrigger>
							<TabsTrigger value="nutrition">{C.tabs.nutrition}</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="activity" className="pt-4">
						<ActivityCharts
							{...common}
							stepsGoal={goalFor('steps')}
							activeGoal={goalFor('activeMinutes')}
						/>
					</TabsContent>
					<TabsContent value="sleep" className="pt-4">
						<SleepChart {...common} sleepGoal={goalFor('sleepMinutes')} />
					</TabsContent>
					<TabsContent value="heart" className="pt-4">
						<HeartCharts {...common} systolicGoal={goalFor('systolic')} />
					</TabsContent>
					<TabsContent value="body" className="pt-4">
						<WeightChart {...common} weightGoal={goalFor('weightKg')} />
					</TabsContent>
					<TabsContent value="nutrition" className="pt-4">
						<NutritionCharts {...common} proteinGoal={goalFor('proteinG')} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	)
}
