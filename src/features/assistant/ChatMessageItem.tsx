import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ASSISTANT_COPY, CHAT_ERROR_COPY, citedMetricLabel } from '@/config/constants/assistant'
import type { ChatMessage } from '@/types/chat'
import AssistantMarkdown from './AssistantMarkdown'
import SuggestionChips from './SuggestionChips'

interface ChatMessageItemProps {
	message: ChatMessage
	/** Last message in the conversation: only it shows follow-ups and Retry. */
	isLast: boolean
	canRetry: boolean
	onRetry: () => void
	onAsk: (question: string) => void
}

function TypingIndicator() {
	return (
		<span className="inline-flex items-center gap-2 text-muted-foreground">
			<span className="flex gap-1" aria-hidden="true">
				<span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
				<span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
				<span className="size-1.5 animate-bounce rounded-full bg-current" />
			</span>
			<span className="text-xs">{ASSISTANT_COPY.thinking}</span>
		</span>
	)
}

function uniqueLabels(keys: string[]): string[] {
	return [...new Set(keys.map(citedMetricLabel))]
}

export default function ChatMessageItem({
	message,
	isLast,
	canRetry,
	onRetry,
	onAsk,
}: ChatMessageItemProps) {
	if (message.role === 'user') {
		return (
			<li className="flex justify-end">
				<div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground break-words">
					<span className="sr-only">{ASSISTANT_COPY.youLabel}: </span>
					{message.content}
				</div>
			</li>
		)
	}

	const isStreaming = message.status === 'streaming'
	const hasText = message.content.trim() !== ''
	const cited = message.meta ? uniqueLabels(message.meta.citedMetrics) : []
	const followUps = isLast && message.status === 'complete' ? (message.meta?.followUps ?? []) : []

	return (
		<li className="flex flex-col gap-2" aria-busy={isStreaming}>
			<div className="max-w-full text-sm break-words">
				<span className="sr-only">{ASSISTANT_COPY.assistantLabel}: </span>
				{hasText && <AssistantMarkdown content={message.content} />}
				{isStreaming && !hasText && <TypingIndicator />}
				{isStreaming && hasText && (
					<span
						aria-hidden="true"
						data-testid="streaming-caret"
						className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-foreground/60"
					/>
				)}
			</div>

			{message.status === 'stopped' && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>{ASSISTANT_COPY.stopped}</span>
					{isLast && canRetry && (
						<Button variant="ghost" size="xs" onClick={onRetry}>
							<RotateCcwIcon data-icon="inline-start" />
							{ASSISTANT_COPY.retry}
						</Button>
					)}
				</div>
			)}

			{message.status === 'error' && message.error && (
				<Alert variant="destructive">
					<CircleAlertIcon />
					<AlertDescription className="flex flex-wrap items-center justify-between gap-2">
						<span>{CHAT_ERROR_COPY[message.error.code]}</span>
						{isLast && canRetry && (
							<Button variant="outline" size="xs" onClick={onRetry}>
								<RotateCcwIcon data-icon="inline-start" />
								{ASSISTANT_COPY.retry}
							</Button>
						)}
					</AlertDescription>
				</Alert>
			)}

			{cited.length > 0 && !isStreaming && (
				<div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
					<span>{ASSISTANT_COPY.basedOn}</span>
					{cited.map((label) => (
						<Badge key={label} variant="secondary" className="font-normal">
							{label}
						</Badge>
					))}
				</div>
			)}

			{followUps.length > 0 && (
				<SuggestionChips label={ASSISTANT_COPY.followUpsLabel} questions={followUps} onSelect={onAsk} />
			)}
		</li>
	)
}
