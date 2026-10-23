import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import { useId, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ASSISTANT_COPY } from '@/config/constants/assistant'
import { cn } from '@/lib/utils'
import { CHAT_LIMITS } from '@/types/chat'

interface ComposerProps {
	value: string
	onChange: (value: string) => void
	onSend: () => void
	onStop: () => void
	isStreaming: boolean
	textareaRef?: Ref<HTMLTextAreaElement>
}

/** Show the counter once the draft reaches this share of the limit. */
const COUNTER_FROM = 0.8

export default function Composer({
	value,
	onChange,
	onSend,
	onStop,
	isStreaming,
	textareaRef,
}: ComposerProps) {
	const hintId = useId()
	const counterId = useId()
	const max = CHAT_LIMITS.maxInputChars
	const length = value.trim().length
	const tooLong = length > max
	const showCounter = value.length >= max * COUNTER_FROM
	const canSend = !isStreaming && length > 0 && !tooLong

	const submit = (event?: FormEvent) => {
		event?.preventDefault()
		if (canSend) onSend()
	}

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		// Enter sends; Shift+Enter inserts a newline; ignore while an IME is composing.
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault()
			submit()
		}
	}

	return (
		<form
			onSubmit={submit}
			className="border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
		>
			<div className="flex items-end gap-2">
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={ASSISTANT_COPY.inputPlaceholder}
					aria-label={ASSISTANT_COPY.inputLabel}
					aria-describedby={`${hintId} ${counterId}`}
					aria-invalid={tooLong || undefined}
					rows={1}
					className="max-h-32 min-h-10 resize-none"
				/>
				{isStreaming ? (
					<Button
						type="button"
						size="icon-lg"
						variant="secondary"
						onClick={onStop}
						aria-label={ASSISTANT_COPY.stop}
					>
						<SquareIcon className="fill-current" />
					</Button>
				) : (
					<Button type="submit" size="icon-lg" disabled={!canSend} aria-label={ASSISTANT_COPY.send}>
						<ArrowUpIcon />
					</Button>
				)}
			</div>
			<div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
				<span id={hintId} className={cn(tooLong && 'text-destructive')}>
					{tooLong ? ASSISTANT_COPY.tooLong(max) : ASSISTANT_COPY.inputHint}
				</span>
				<span
					id={counterId}
					className={cn('tabular-nums', !showCounter && 'sr-only', tooLong && 'text-destructive')}
				>
					{showCounter ? ASSISTANT_COPY.charCount(value.trim().length, max) : ''}
				</span>
			</div>
		</form>
	)
}
