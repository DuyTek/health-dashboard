import { Button } from '@/components/ui/button'

interface SuggestionChipsProps {
	/** Accessible name for the group. */
	label: string
	questions: readonly string[]
	onSelect: (question: string) => void
	disabled?: boolean
}

/** A wrap of clickable question chips (suggested prompts, follow-ups). */
export default function SuggestionChips({
	label,
	questions,
	onSelect,
	disabled = false,
}: SuggestionChipsProps) {
	return (
		<ul aria-label={label} className="flex flex-wrap gap-1.5">
			{questions.map((question) => (
				<li key={question}>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						className="h-auto min-h-7 rounded-full py-1 text-left whitespace-normal"
						onClick={() => onSelect(question)}
					>
						{question}
					</Button>
				</li>
			))}
		</ul>
	)
}
