import { useEffect, useLayoutEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ASSISTANT_COPY } from '@/config/constants/assistant'
import type { ChatMessage } from '@/types/chat'
import ChatMessageItem from './ChatMessageItem'

interface MessageListProps {
	messages: ChatMessage[]
	canRetry: boolean
	onRetry: () => void
	onAsk: (question: string) => void
}

/** Distance from the bottom (px) within which we keep following new content. */
const STICK_THRESHOLD = 48

export default function MessageList({ messages, canRetry, onRetry, onAsk }: MessageListProps) {
	const rootRef = useRef<HTMLDivElement>(null)
	const stickToBottom = useRef(true)
	const lastUserId = useRef<string | undefined>(undefined)

	// Track whether the user has scrolled up; if so, stop auto-scrolling.
	useEffect(() => {
		const viewport = rootRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
		if (!viewport) return
		const onScroll = () => {
			const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
			stickToBottom.current = distance <= STICK_THRESHOLD
		}
		viewport.addEventListener('scroll', onScroll, { passive: true })
		return () => viewport.removeEventListener('scroll', onScroll)
	}, [])

	// Follow streaming text; always jump down when the user sends a new message.
	useLayoutEffect(() => {
		const viewport = rootRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
		if (!viewport) return
		const newestUser = messages.findLast((m) => m.role === 'user')?.id
		if (newestUser !== lastUserId.current) {
			lastUserId.current = newestUser
			stickToBottom.current = true
		}
		if (stickToBottom.current) viewport.scrollTop = viewport.scrollHeight
	}, [messages])

	return (
		<ScrollArea ref={rootRef} className="min-h-0 flex-1">
			<ol
				role="log"
				aria-live="polite"
				aria-label={ASSISTANT_COPY.messagesLabel}
				className="flex flex-col gap-4 p-4"
			>
				{messages.map((message, index) => (
					<ChatMessageItem
						key={message.id}
						message={message}
						isLast={index === messages.length - 1}
						canRetry={canRetry}
						onRetry={onRetry}
						onAsk={onAsk}
					/>
				))}
			</ol>
		</ScrollArea>
	)
}
