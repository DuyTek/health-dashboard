import { SparklesIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ASSISTANT_COPY } from '@/config/constants/assistant'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/store'
import {
	closed,
	selectHasUnread,
	selectIsOpen,
	selectIsStreaming,
	toggled,
} from '@/store/chatSlice'
import AssistantPanel from './AssistantPanel'

/**
 * Floating launcher (bottom-right) plus the assistant panel. The draft lives
 * here so it survives closing and reopening the panel.
 */
export default function FloatingAssistant() {
	const dispatch = useAppDispatch()
	const isOpen = useAppSelector(selectIsOpen)
	const isStreaming = useAppSelector(selectIsStreaming)
	const hasUnread = useAppSelector(selectHasUnread)
	const [draft, setDraft] = useState('')
	const fabRef = useRef<HTMLButtonElement>(null)
	const wasOpen = useRef(isOpen)

	// Return focus to the launcher when the panel closes.
	useEffect(() => {
		if (wasOpen.current && !isOpen) fabRef.current?.focus()
		wasOpen.current = isOpen
	}, [isOpen])

	const status = isStreaming
		? ASSISTANT_COPY.fabStreaming
		: hasUnread
			? ASSISTANT_COPY.fabUnread
			: null

	return (
		<>
			{isOpen && (
				<AssistantPanel draft={draft} onDraftChange={setDraft} onClose={() => dispatch(closed())} />
			)}
			<Button
				ref={fabRef}
				type="button"
				onClick={() => dispatch(toggled())}
				aria-label={isOpen ? ASSISTANT_COPY.fabClose : ASSISTANT_COPY.fabOpen}
				aria-expanded={isOpen}
				aria-haspopup="dialog"
				aria-describedby={status ? 'assistant-fab-status' : undefined}
				className={cn(
					'fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 size-14 rounded-full shadow-lg',
					// On phones the open panel is full-screen and has its own close button.
					isOpen && 'max-sm:hidden',
				)}
			>
				{isOpen ? <XIcon className="size-6" /> : <SparklesIcon className="size-6" />}
				{status && (
					<span
						aria-hidden="true"
						className={cn(
							'absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-background',
							isStreaming ? 'animate-pulse bg-amber-500' : 'bg-emerald-500',
						)}
					/>
				)}
			</Button>
			{status && (
				<span id="assistant-fab-status" className="sr-only">
					{status}
				</span>
			)}
		</>
	)
}
