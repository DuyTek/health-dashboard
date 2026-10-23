import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'

/** Mirrors the loaded layout so nothing jumps when data arrives. */
export default function DashboardSkeleton() {
	return (
		<div className="flex flex-col gap-6" data-testid="dashboard-skeleton">
			<span className="sr-only" role="status">
				{DASHBOARD_COPY.loadingLabel}
			</span>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton key={i} className="h-28 rounded-xl" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="flex flex-col gap-6 lg:order-2">
					{[0, 1].map((i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-5 w-32" />
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card className="lg:order-1 lg:col-span-2">
					<CardHeader>
						<Skeleton className="h-5 w-24" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-72 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
