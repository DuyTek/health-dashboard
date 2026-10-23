import type { PropsWithChildren } from 'react'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'

interface ChartFrameProps {
	title: string
	/** Plain-language summary read by screen readers and shown as a caption. */
	summary: string
	isEmpty: boolean
}

/** Titled chart with an accessible summary and an empty state. */
export default function ChartFrame({
	title,
	summary,
	isEmpty,
	children,
}: PropsWithChildren<ChartFrameProps>) {
	return (
		<figure className="flex flex-col gap-2" aria-label={title}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
				<h3 className="text-sm font-medium">{title}</h3>
				{!isEmpty && <figcaption className="text-xs text-muted-foreground">{summary}</figcaption>}
			</div>
			{isEmpty ? (
				<div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					{DASHBOARD_COPY.trends.emptyChart}
				</div>
			) : (
				children
			)}
		</figure>
	)
}
