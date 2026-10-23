import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import { makeStore } from './store'
import './index.css'

const store = makeStore()

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Provider store={store}>
			<TooltipProvider>
				<App />
			</TooltipProvider>
		</Provider>
	</StrictMode>,
)
