// Public API of the pure health logic. Isomorphic: imported by the dashboard
// and by the assistant server, so relative imports only.

export {
	buildHealthSummary,
	computeGoalProgress,
	percentChange,
	summarizeMetric,
	trendFromChange,
	RECENT_ACTIVITY_LIMIT,
} from './summary.js'
export { buildInsights, formatDuration, type InsightInput } from './insights.js'
export {
	getMetricValue,
	mean,
	METRIC_KEYS,
	METRIC_META,
	roundTo,
	type MetricMeta,
} from './metrics.js'
export {
	aggregateWeekly,
	endOfWeek,
	selectDays,
	selectSeries,
	valuesInWindow,
	type RangeDays,
	type SeriesPoint,
	type WeeklyRow,
} from './series.js'
export { addDays, dayOfWeek, daysBetween, inWindow, startOfWeek } from './dates.js'
