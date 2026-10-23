import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSISTANT_COPY, CHAT_ERROR_COPY, SUGGESTED_PROMPTS } from '@/config/constants/assistant'
import { renderWithStore } from '@/test/render'
import { controlledSseResponse, sseFrames, sseResponse } from '@/test/sse'
import { CHAT_LIMITS, type ChatRequest } from '@/types/chat'
import FloatingAssistant from './FloatingAssistant'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
	fetchMock.mockReset()
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

function requestAt(index: number): ChatRequest {
	return JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as ChatRequest
}

async function openPanel() {
	const user = userEvent.setup()
	const view = renderWithStore(<FloatingAssistant />)
	await user.click(screen.getByRole('button', { name: ASSISTANT_COPY.fabOpen }))
	return { user, ...view }
}

describe('FloatingAssistant', () => {
	it('opens from the launcher, focuses the composer and shows suggested prompts', async () => {
		await openPanel()
		expect(screen.getByRole('dialog', { name: ASSISTANT_COPY.title })).toBeInTheDocument()
		expect(screen.getByRole('textbox', { name: ASSISTANT_COPY.inputLabel })).toHaveFocus()
		const prompts = screen.getByRole('list', { name: ASSISTANT_COPY.suggestedLabel })
		for (const prompt of SUGGESTED_PROMPTS) {
			expect(within(prompts).getByRole('button', { name: prompt })).toBeInTheDocument()
		}
	})

	it('closes on Escape and returns focus to the launcher', async () => {
		const { user } = await openPanel()
		await user.keyboard('{Escape}')
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: ASSISTANT_COPY.fabOpen })).toHaveFocus()
	})

	it('streams a reply to a suggested prompt as markdown with sources and follow-ups', async () => {
		fetchMock.mockResolvedValueOnce(
			sseResponse([
				sseFrames([{ type: 'delta', text: '## Summary\n\nYou are **on track**' }]),
				sseFrames([
					{ type: 'delta', text: ' with steps.\n\n- Sleep improved' },
					{
						type: 'meta',
						meta: {
							citedMetrics: ['steps', 'sleepMinutes'],
							followUps: ['How can I sleep better?'],
						},
					},
					{ type: 'done' },
				]),
			]),
		)
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'delta', text: 'Go to bed earlier.' }, { type: 'done' }])),
		)
		const { user } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[0] }))

		expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument()
		expect(screen.getByText('on track').tagName).toBe('STRONG')
		expect(screen.getByText('Sleep improved').tagName).toBe('LI')
		expect(screen.getByText(ASSISTANT_COPY.basedOn)).toBeInTheDocument()
		expect(screen.getByText('steps')).toBeInTheDocument()
		expect(screen.getByText('sleep')).toBeInTheDocument()
		expect(requestAt(0)).toEqual({ messages: [{ role: 'user', content: SUGGESTED_PROMPTS[0] }] })

		const followUps = screen.getByRole('list', { name: ASSISTANT_COPY.followUpsLabel })
		await user.click(within(followUps).getByRole('button', { name: 'How can I sleep better?' }))
		expect(await screen.findByText('Go to bed earlier.')).toBeInTheDocument()
		expect(requestAt(1).messages.at(-1)).toEqual({
			role: 'user',
			content: 'How can I sleep better?',
		})
		expect(requestAt(1).messages).toHaveLength(3)
	})

	it('does not render raw HTML from the model', async () => {
		fetchMock.mockResolvedValueOnce(
			sseResponse(
				sseFrames([
					{ type: 'delta', text: 'Safe <img src=x onerror="alert(1)"> text' },
					{ type: 'done' },
				]),
			),
		)
		const { user, container } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[1] }))
		await screen.findByText(/Safe/)
		expect(container.ownerDocument.querySelector('img')).toBeNull()
	})

	it('sends with Enter, keeps Shift+Enter as a newline and shows a typing indicator', async () => {
		const stream = controlledSseResponse()
		fetchMock.mockResolvedValueOnce(stream.response)
		const { user } = await openPanel()
		const input = screen.getByRole('textbox', { name: ASSISTANT_COPY.inputLabel })

		await user.type(input, 'Line one{Shift>}{Enter}{/Shift}line two')
		expect(input).toHaveValue('Line one\nline two')
		await user.keyboard('{Enter}')

		expect(input).toHaveValue('')
		expect(requestAt(0).messages[0].content).toBe('Line one\nline two')
		expect(await screen.findByText(ASSISTANT_COPY.thinking)).toBeInTheDocument()

		stream.push(sseFrames([{ type: 'delta', text: 'Hello' }]))
		expect(await screen.findByText('Hello')).toBeInTheDocument()
		expect(screen.getByTestId('streaming-caret')).toBeInTheDocument()
		stream.push(sseFrames([{ type: 'done' }]))
		stream.close()
		await waitFor(() => expect(screen.queryByTestId('streaming-caret')).not.toBeInTheDocument())
	})

	it('lets the user stop a streaming answer', async () => {
		const stream = controlledSseResponse()
		fetchMock.mockResolvedValueOnce(stream.response)
		const { user } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[2] }))
		stream.push(sseFrames([{ type: 'delta', text: 'Partial answer' }]))
		await screen.findByText('Partial answer')

		await user.click(screen.getByRole('button', { name: ASSISTANT_COPY.stop }))
		expect(await screen.findByText(ASSISTANT_COPY.stopped)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: ASSISTANT_COPY.send })).toBeInTheDocument()
		expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
	})

	it('shows a friendly error with Retry, and retries the same question', async () => {
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'error', code: 'rate_limited', message: '429 quota' }])),
		)
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'delta', text: 'Recovered answer' }, { type: 'done' }])),
		)
		const { user } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[3] }))

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent(CHAT_ERROR_COPY.rate_limited)
		await user.click(within(alert).getByRole('button', { name: ASSISTANT_COPY.retry }))

		expect(await screen.findByText('Recovered answer')).toBeInTheDocument()
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(requestAt(1)).toEqual({ messages: [{ role: 'user', content: SUGGESTED_PROMPTS[3] }] })
		expect(screen.getAllByText(SUGGESTED_PROMPTS[3])).toHaveLength(1)
	})

	it('shows a network error when the server is unreachable', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
		const { user } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[4] }))
		expect(await screen.findByRole('alert')).toHaveTextContent(CHAT_ERROR_COPY.upstream_error)
	})

	it('blocks messages over the character limit and shows the counter', async () => {
		const { user } = await openPanel()
		const input = screen.getByRole('textbox', { name: ASSISTANT_COPY.inputLabel })
		await user.click(input)
		await user.paste('x'.repeat(CHAT_LIMITS.maxInputChars + 1))

		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByText(ASSISTANT_COPY.tooLong(CHAT_LIMITS.maxInputChars))).toBeInTheDocument()
		expect(
			screen.getByText(
				ASSISTANT_COPY.charCount(CHAT_LIMITS.maxInputChars + 1, CHAT_LIMITS.maxInputChars),
			),
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: ASSISTANT_COPY.send })).toBeDisabled()
		await user.keyboard('{Enter}')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('clears the conversation back to the empty state', async () => {
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'delta', text: 'Answer' }, { type: 'done' }])),
		)
		const { user } = await openPanel()
		await user.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[0] }))
		await screen.findByText('Answer')
		await user.click(screen.getByRole('button', { name: ASSISTANT_COPY.clearLabel }))
		expect(screen.getByRole('list', { name: ASSISTANT_COPY.suggestedLabel })).toBeInTheDocument()
	})
})
