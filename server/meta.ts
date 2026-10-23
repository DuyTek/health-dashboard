import { z } from 'zod'
import type { AssistantMeta } from '../src/types/chat.js'
import { CITABLE_SOURCES } from './metrics.js'
import { MAX_FOLLOW_UPS, META_CLOSE, META_OPEN } from './prompt.js'

// Splits the model's streamed text into the user-visible markdown answer and
// the trailing `<meta>{...}</meta>` block (see the output protocol in
// prompt.ts). Text is released as soon as it cannot be part of a tag, so the
// answer still streams token by token; only a short suffix that might be the
// start of `<meta>` / `</meta>` is held back until the next chunk decides it.

const MAX_FOLLOW_UP_CHARS = 160
const TAGS = [META_OPEN, META_CLOSE] as const

const rawMetaSchema = z.object({
	citedMetrics: z.array(z.unknown()).optional(),
	followUps: z.array(z.unknown()).optional(),
})

/** Validates and normalises the JSON inside `<meta>`; `null` if unusable. */
export function parseMeta(raw: string): AssistantMeta | null {
	let text = raw.trim()
	// Tolerate ```json fences and stray prose around the object.
	text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '')
	const start = text.indexOf('{')
	const end = text.lastIndexOf('}')
	if (start === -1 || end <= start) return null

	let json: unknown
	try {
		json = JSON.parse(text.slice(start, end + 1))
	} catch {
		return null
	}
	const parsed = rawMetaSchema.safeParse(json)
	if (!parsed.success) return null

	const allowed = new Set(CITABLE_SOURCES)
	const citedMetrics = [
		...new Set(
			(parsed.data.citedMetrics ?? []).filter(
				(m): m is string => typeof m === 'string' && allowed.has(m),
			),
		),
	]
	const followUps = (parsed.data.followUps ?? [])
		.filter((q): q is string => typeof q === 'string')
		.map((q) => q.trim())
		.filter((q) => q.length > 0 && q.length <= MAX_FOLLOW_UP_CHARS)
		.slice(0, MAX_FOLLOW_UPS)

	return { citedMetrics, followUps }
}

/** Length of the longest suffix of `text` that is a proper prefix of a tag. */
function partialTagSuffixLength(text: string): number {
	const lower = text.toLowerCase()
	let longest = 0
	for (const tag of TAGS) {
		const max = Math.min(tag.length - 1, lower.length)
		for (let len = max; len > longest; len--) {
			if (lower.endsWith(tag.slice(0, len))) {
				longest = len
				break
			}
		}
	}
	return longest
}

export interface MetaSplitResult {
	/** Remaining answer text to emit (may be empty). */
	text: string
	meta: AssistantMeta | null
}

export class MetaStreamSplitter {
	/** Text not yet emitted (only ever a possible tag prefix in answer mode). */
	private pending = ''
	private inMeta = false
	private metaRaw = ''
	private meta: AssistantMeta | null = null

	/** Feeds a chunk; returns the text that is now safe to display. */
	push(chunk: string): string {
		this.pending += chunk
		let out = ''
		// Loop: a single chunk may contain an open tag, the JSON and a close tag.
		for (;;) {
			const lower = this.pending.toLowerCase()
			if (this.inMeta) {
				const close = lower.indexOf(META_CLOSE)
				if (close === -1) {
					// Keep a possible partial `</meta>` out of the JSON for now.
					const keep = partialTagSuffixLength(this.pending)
					this.metaRaw += this.pending.slice(0, this.pending.length - keep)
					this.pending = this.pending.slice(this.pending.length - keep)
					return out
				}
				this.metaRaw += this.pending.slice(0, close)
				this.pending = this.pending.slice(close + META_CLOSE.length)
				this.closeMeta()
				continue
			}

			const open = lower.indexOf(META_OPEN)
			const strayClose = lower.indexOf(META_CLOSE)
			if (strayClose !== -1 && (open === -1 || strayClose < open)) {
				// A `</meta>` without an opening tag: drop the tag, keep the text.
				out += this.pending.slice(0, strayClose)
				this.pending = this.pending.slice(strayClose + META_CLOSE.length)
				continue
			}
			if (open !== -1) {
				out += this.pending.slice(0, open)
				this.pending = this.pending.slice(open + META_OPEN.length)
				this.inMeta = true
				this.metaRaw = ''
				continue
			}
			const keep = partialTagSuffixLength(this.pending)
			out += this.pending.slice(0, this.pending.length - keep)
			this.pending = this.pending.slice(this.pending.length - keep)
			return out
		}
	}

	/** Ends the stream: flushes held-back text and returns the parsed meta. */
	finish(): MetaSplitResult {
		let text = ''
		if (this.inMeta) {
			// Unterminated block: try to salvage the JSON, never show it.
			this.metaRaw += this.pending
			this.closeMeta()
		} else {
			text = this.pending
		}
		this.pending = ''
		return { text, meta: this.meta }
	}

	private closeMeta(): void {
		this.inMeta = false
		// First valid block wins; any block is hidden from the answer.
		if (this.meta === null) this.meta = parseMeta(this.metaRaw)
		this.metaRaw = ''
	}
}
