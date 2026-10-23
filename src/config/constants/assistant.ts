import type { ChatErrorCode } from '@/types/chat'

// User-facing copy for the floating AI assistant.

export const ASSISTANT_COPY = {
	title: 'Health assistant',
	subtitle: 'AI · uses only your dashboard data · not medical advice',
	fabOpen: 'Open health assistant',
	fabClose: 'Close health assistant',
	fabUnread: 'New reply',
	fabStreaming: 'Assistant is replying',
	close: 'Close',
	clear: 'Clear',
	clearLabel: 'Clear conversation',
	emptyTitle: 'Ask about your health data',
	emptyIntro:
		'I can explain trends, progress toward your goals and where to focus — using only the numbers on your dashboard.',
	suggestedLabel: 'Suggested questions',
	followUpsLabel: 'Suggested follow-up questions',
	basedOn: 'Based on:',
	inputLabel: 'Message the health assistant',
	inputPlaceholder: 'Ask about your activity, sleep, goals…',
	inputHint: 'Enter to send · Shift+Enter for a new line',
	tooLong: (max: number) => `Messages can be up to ${max} characters.`,
	charCount: (count: number, max: number) => `${count}/${max}`,
	send: 'Send message',
	stop: 'Stop generating',
	retry: 'Retry',
	stopped: 'Stopped',
	thinking: 'Thinking…',
	youLabel: 'You',
	assistantLabel: 'Assistant',
	messagesLabel: 'Conversation',
} as const

/** Clickable prompts shown in the empty state. */
export const SUGGESTED_PROMPTS = [
	'How am I progressing?',
	'What should I focus on?',
	'How has my activity changed?',
	'Give me a summary of my current health.',
	'What are some areas I could improve?',
] as const

/** Friendly, actionable copy per error code. The server's raw message is not shown. */
export const CHAT_ERROR_COPY: Record<ChatErrorCode, string> = {
	invalid_request: "That message couldn't be sent. Try rephrasing or shortening it.",
	rate_limited: 'The free AI quota is busy — try again in a minute.',
	timeout: 'The assistant took too long to answer. Please try again.',
	blocked: "The assistant can't answer that one. Try asking about your health data differently.",
	empty_response: 'The assistant returned an empty answer. Please try again.',
	config_error: "Assistant isn't configured (missing API key).",
	upstream_error: 'Something went wrong reaching the assistant. Check your connection and retry.',
}

/** Shown when fetch itself fails (offline, DNS, server down). */
export const NETWORK_ERROR_MESSAGE = "Couldn't reach the assistant. Check your connection."

/** Display names for the metric keys the model cites in `meta.citedMetrics`. */
export const CITED_METRIC_LABELS: Record<string, string> = {
	steps: 'steps',
	activeMinutes: 'active minutes',
	sleepMinutes: 'sleep',
	restingHeartRate: 'resting heart rate',
	hrvMs: 'HRV',
	weightKg: 'weight',
	caloriesIn: 'calories',
	proteinG: 'protein',
	waterMl: 'hydration',
	systolic: 'blood pressure',
	diastolic: 'blood pressure',
	mood: 'mood',
	activities: 'activities',
	goals: 'goals',
}

/** Turns a camelCase metric key into readable text when no label is defined. */
export function citedMetricLabel(key: string): string {
	return (
		CITED_METRIC_LABELS[key] ??
		key
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/[_-]+/g, ' ')
			.toLowerCase()
	)
}
