import { APP_COPY } from '@/config/constants/app'
import FloatingAssistant from '@/features/assistant/FloatingAssistant'
import Dashboard from '@/features/dashboard/Dashboard'

// Layout shell only. The dashboard and assistant are owned by separate
// feature folders so they can evolve independently.
export default function App() {
	return (
		<div className="min-h-svh bg-background text-foreground">
			<main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
				<Dashboard />
			</main>
			<footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground sm:px-6 lg:px-8">
				{APP_COPY.disclaimer}
			</footer>
			<FloatingAssistant />
		</div>
	)
}
