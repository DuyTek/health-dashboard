import { screen } from '@testing-library/react'
import App from './App'
import { APP_COPY } from './config/constants/app'
import { renderWithStore } from './test/render'

describe('App shell', () => {
	it('renders the medical disclaimer', () => {
		renderWithStore(<App />)
		expect(screen.getByText(APP_COPY.disclaimer)).toBeInTheDocument()
	})
})
