import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DASHBOARD_COPY } from '@/config/constants/dashboard'

export default function DashboardEmpty() {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-2 py-10 text-center">
				<Activity aria-hidden="true" className="size-8 text-muted-foreground" />
				<h2 className="text-base font-medium">{DASHBOARD_COPY.empty.title}</h2>
				<p className="max-w-sm text-sm text-muted-foreground">{DASHBOARD_COPY.empty.body}</p>
			</CardContent>
		</Card>
	)
}
