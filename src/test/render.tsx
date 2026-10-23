import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { TooltipProvider } from '@/components/ui/tooltip'
import { makeStore, type AppStore } from '@/store'

/** Render with a fresh Redux store and the app-level providers. */
export function renderWithStore(
	ui: ReactElement,
	{ store = makeStore(), ...options }: { store?: AppStore } & RenderOptions = {},
) {
	return {
		store,
		...render(
			<Provider store={store}>
				<TooltipProvider>{ui}</TooltipProvider>
			</Provider>,
			options,
		),
	}
}
