import { RotateCw, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'

interface DashboardErrorProps {
	message: string | null
	onRetry: () => void
}

export default function DashboardError({ message, onRetry }: DashboardErrorProps) {
	return (
		<Alert variant="destructive" className="max-w-xl">
			<TriangleAlert aria-hidden="true" />
			<AlertTitle>{DASHBOARD_COPY.error.title}</AlertTitle>
			<AlertDescription className="flex flex-col items-start gap-3">
				<p>{message ?? DASHBOARD_COPY.error.fallback}</p>
				<Button variant="outline" size="sm" onClick={onRetry}>
					<RotateCw aria-hidden="true" />
					{DASHBOARD_COPY.error.retry}
				</Button>
			</AlertDescription>
		</Alert>
	)
}
