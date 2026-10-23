import { SparklesIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ASSISTANT_COPY, SUGGESTED_PROMPTS } from '@/config/constants/assistant'
import { useAppDispatch, useAppSelector } from '@/store'
import {
	clearConversation,
	retryLast,
	selectCanRetry,
	selectIsStreaming,
	selectMessages,
	sendMessage,
	stopGeneration,
} from '@/store/chatSlice'
import Composer from './Composer'
import MessageList from './MessageList'
import SuggestionChips from './SuggestionChips'

interface AssistantPanelProps {
	draft: string
	onDraftChange: (value: string) => void
	onClose: () => void
}

/**
 * The chat panel. Full-screen on phones; a 400×600 card anchored above the
 * launcher from `sm` up. Non-modal on desktop so the dashboard stays usable.
 */
export default function AssistantPanel({ draft, onDraftChange, onClose }: AssistantPanelProps) {
	const dispatch = useAppDispatch()
	const messages = useAppSelector(selectMessages)
	const isStreaming = useAppSelector(selectIsStreaming)
	const canRetry = useAppSelector(selectCanRetry)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const titleId = useId()
	const descriptionId = useId()

	useEffect(() => {
		textareaRef.current?.focus()
	}, [])

	const ask = (question: string) => {
		void dispatch(sendMessage(question))
		textareaRef.current?.focus()
	}

	const send = () => {
		// The composer only calls this when the draft is sendable.
		void dispatch(sendMessage(draft))
		onDraftChange('')
		textareaRef.current?.focus()
	}

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Escape') {
			event.stopPropagation()
			onClose()
		}
	}

	return (
		<div
			role="dialog"
			aria-modal="false"
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
			onKeyDown={onKeyDown}
			className="fixed inset-0 z-50 flex flex-col bg-background text-foreground animate-in fade-in-0 slide-in-from-bottom-4 duration-200 sm:inset-auto sm:right-[calc(1rem+env(safe-area-inset-right))] sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:h-[min(600px,calc(100svh-7.5rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-xl sm:border sm:shadow-2xl"
		>
			<header className="flex items-start gap-2 border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 sm:pt-3">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
					<SparklesIcon className="size-4" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<h2 id={titleId} className="font-heading text-sm font-semibold">
						{ASSISTANT_COPY.title}
					</h2>
					<p id={descriptionId} className="text-xs text-muted-foreground">
						{ASSISTANT_COPY.subtitle}
					</p>
				</div>
				{messages.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							dispatch(clearConversation())
							textareaRef.current?.focus()
						}}
						aria-label={ASSISTANT_COPY.clearLabel}
					>
						<Trash2Icon data-icon="inline-start" />
						{ASSISTANT_COPY.clear}
					</Button>
				)}
				<Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={ASSISTANT_COPY.close}>
					<XIcon />
				</Button>
			</header>

			{messages.length === 0 ? (
				<div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto p-4">
					<div>
						<p className="text-sm font-medium">{ASSISTANT_COPY.emptyTitle}</p>
						<p className="mt-1 text-sm text-muted-foreground">{ASSISTANT_COPY.emptyIntro}</p>
					</div>
					<SuggestionChips
						label={ASSISTANT_COPY.suggestedLabel}
						questions={SUGGESTED_PROMPTS}
						onSelect={ask}
					/>
				</div>
			) : (
				<MessageList
					messages={messages}
					canRetry={canRetry}
					onRetry={() => void dispatch(retryLast())}
					onAsk={ask}
				/>
			)}

			<Composer
				value={draft}
				onChange={onDraftChange}
				onSend={send}
				onStop={() => dispatch(stopGeneration())}
				isStreaming={isStreaming}
				textareaRef={textareaRef}
			/>
		</div>
	)
}
