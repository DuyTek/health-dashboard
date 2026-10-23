import { ArrowDown, ArrowUp, Footprints, HeartPulse, Gauge, Minus, Moon, Scale } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'
import { cn } from '@/lib/utils'
import type { HealthSummary, MetricSummary } from '@/types/health'
import { formatHoursMinutes, formatNumber, formatWeekdayDate } from './format'
import { compareToAverage, type Comparison } from './kpi'

interface TodayGlanceProps {
	summary: HealthSummary
}

interface Tile {
	id: string
	label: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	value: string
	unit?: string
	metric: MetricSummary
	comparison: Comparison | null
	formatDelta: (delta: number) => string
}

const signed = (n: number, text: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${text}`

function buildTiles(summary: HealthSummary): Tile[] {
	const { metrics: m } = summary
	const L = DASHBOARD_COPY.glance.labels
	const compare = (metric: MetricSummary) =>
		compareToAverage(metric.latest, metric.avg7, metric.higherIsBetter)
	const dash = '—'

	return [
		{
			id: 'steps',
			label: L.steps,
			icon: Footprints,
			value: m.steps.latest === null ? dash : formatNumber(m.steps.latest),
			metric: m.steps,
			comparison: compare(m.steps),
			formatDelta: (d) => signed(d, formatNumber(Math.abs(d))),
		},
		{
			id: 'sleep',
			label: L.sleep,
			icon: Moon,
			value: m.sleepMinutes.latest === null ? dash : formatHoursMinutes(m.sleepMinutes.latest),
			metric: m.sleepMinutes,
			comparison: compare(m.sleepMinutes),
			formatDelta: (d) => signed(d, `${Math.round(Math.abs(d))}m`),
		},
		{
			id: 'rhr',
			label: L.rhr,
			icon: HeartPulse,
			value: m.restingHeartRate.latest === null ? dash : formatNumber(m.restingHeartRate.latest),
			unit: 'bpm',
			metric: m.restingHeartRate,
			comparison: compare(m.restingHeartRate),
			formatDelta: (d) => signed(d, formatNumber(Math.abs(d), 1)),
		},
		{
			id: 'weight',
			label: L.weight,
			icon: Scale,
			value: m.weightKg.latest === null ? dash : formatNumber(m.weightKg.latest, 1),
			unit: 'kg',
			metric: m.weightKg,
			comparison: compareToAverage(m.weightKg.latest, m.weightKg.avg7, false, 0.3),
			formatDelta: (d) => signed(d, formatNumber(Math.abs(d), 1)),
		},
		{
			id: 'bp',
			label: L.bp,
			icon: Gauge,
			value:
				m.systolic.latest === null || m.diastolic.latest === null
					? dash
					: `${m.systolic.latest}/${m.diastolic.latest}`,
			unit: 'mmHg',
			metric: m.systolic,
			comparison: compare(m.systolic),
			formatDelta: (d) => signed(d, `${formatNumber(Math.abs(d))} sys`),
		},
	]
}

const TONE_CLASS = {
	good: 'text-emerald-700 dark:text-emerald-400',
	bad: 'text-rose-700 dark:text-rose-400',
	neutral: 'text-muted-foreground',
} as const

const TONE_TEXT = {
	good: DASHBOARD_COPY.glance.better,
	bad: DASHBOARD_COPY.glance.worse,
	neutral: DASHBOARD_COPY.glance.same,
} as const

function DeltaLine({ tile, asOf }: { tile: Tile; asOf: string }) {
	const { comparison, metric } = tile
	if (metric.latest === null) {
		return <p className="text-xs text-muted-foreground">{DASHBOARD_COPY.glance.noData}</p>
	}
	const stale = metric.latestDate !== null && metric.latestDate !== asOf
	return (
		<div className="flex flex-col gap-0.5 text-xs">
			{comparison && (
				<p className={cn('flex items-center gap-1 font-medium', TONE_CLASS[comparison.tone])}>
					{comparison.delta > 0 ? (
						<ArrowUp aria-hidden="true" className="size-3" />
					) : comparison.delta < 0 ? (
						<ArrowDown aria-hidden="true" className="size-3" />
					) : (
						<Minus aria-hidden="true" className="size-3" />
					)}
					<span>
						{tile.formatDelta(comparison.delta)}{' '}
						<span className="font-normal text-muted-foreground">{DASHBOARD_COPY.glance.vsAvg}</span>
					</span>
					<span className="sr-only">, {TONE_TEXT[comparison.tone]}</span>
				</p>
			)}
			{stale && metric.latestDate && (
				<p className="text-muted-foreground">
					{DASHBOARD_COPY.glance.lastReading(formatWeekdayDate(metric.latestDate))}
				</p>
			)}
		</div>
	)
}

export default function TodayGlance({ summary }: TodayGlanceProps) {
	const tiles = buildTiles(summary)
	return (
		<section aria-labelledby="glance-heading" className="flex flex-col gap-3">
			<h2 id="glance-heading" className="text-sm font-medium text-muted-foreground">
				{DASHBOARD_COPY.glance.title}
			</h2>
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{tiles.map((tile) => (
					<li
						key={tile.id}
						className="flex flex-col gap-2 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 last:col-span-2 sm:last:col-span-1"
					>
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<tile.icon aria-hidden="true" className="size-3.5" />
							<span>{tile.label}</span>
						</div>
						<p className="text-2xl font-semibold tracking-tight tabular-nums">
							{tile.value}
							{tile.unit && tile.metric.latest !== null && (
								<span className="ml-1 text-sm font-normal text-muted-foreground">{tile.unit}</span>
							)}
						</p>
						<DeltaLine tile={tile} asOf={summary.asOf} />
					</li>
				))}
			</ul>
		</section>
	)
}
