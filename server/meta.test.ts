// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MetaStreamSplitter, parseMeta } from './meta.js'

/** Feeds chunks and returns every emitted piece plus the final result. */
function run(chunks: string[]) {
	const splitter = new MetaStreamSplitter()
	const emitted = chunks.map((c) => splitter.push(c))
	const end = splitter.finish()
	return { emitted, text: emitted.join('') + end.text, meta: end.meta, tail: end.text }
}

const META =
	'<meta>{"citedMetrics":["steps","sleepMinutes"],"followUps":["How is my sleep?"]}</meta>'

describe('MetaStreamSplitter', () => {
	it('separates the answer from a well-formed meta block', () => {
		const result = run([`Your steps are up.\n\n${META}`])
		expect(result.text).toBe('Your steps are up.\n\n')
		expect(result.meta).toEqual({
			citedMetrics: ['steps', 'sleepMinutes'],
			followUps: ['How is my sleep?'],
		})
	})

	it('handles the open tag split across chunks', () => {
		const result = run(['Answer <me', 'ta>{"citedMetrics":[],"followUps":[]}</me', 'ta>'])
		expect(result.text).toBe('Answer ')
		expect(result.meta).toEqual({ citedMetrics: [], followUps: [] })
	})

	it('handles every possible split point of the full text', () => {
		const full = `Hello **there**.\n${META}`
		for (let i = 0; i <= full.length; i++) {
			const result = run([full.slice(0, i), full.slice(i)])
			expect(result.text).toBe('Hello **there**.\n')
			expect(result.meta?.citedMetrics).toEqual(['steps', 'sleepMinutes'])
		}
	})

	it('streams character by character without leaking the tag', () => {
		const full = `Hi.${META}`
		const result = run([...full])
		expect(result.text).toBe('Hi.')
		expect(result.emitted.join('')).not.toContain('<')
		expect(result.meta).not.toBeNull()
	})

	it('holds back a lone "<" and releases it when it is not a tag', () => {
		const splitter = new MetaStreamSplitter()
		expect(splitter.push('a <')).toBe('a ')
		expect(splitter.push(' b')).toBe('< b')
		expect(splitter.finish()).toEqual({ text: '', meta: null })
	})

	it('emits text immediately when it cannot be a tag', () => {
		const splitter = new MetaStreamSplitter()
		expect(splitter.push('Steps 8,000 > 7,000')).toBe('Steps 8,000 > 7,000')
	})

	it('flushes a trailing partial tag at the end', () => {
		expect(run(['ends with <me']).text).toBe('ends with <me')
	})

	it('keeps the answer and returns null meta when there is no block', () => {
		const result = run(['Just an answer.'])
		expect(result.text).toBe('Just an answer.')
		expect(result.meta).toBeNull()
	})

	it('returns null meta for invalid JSON but still hides the block', () => {
		const result = run(['Answer.<meta>{citedMetrics: oops</meta>'])
		expect(result.text).toBe('Answer.')
		expect(result.meta).toBeNull()
	})

	it('accepts fenced JSON and surrounding whitespace', () => {
		const result = run([
			'Answer.\n<meta>\n```json\n{"citedMetrics":["goals"],"followUps":[]}\n```\n</meta>',
		])
		expect(result.meta).toEqual({ citedMetrics: ['goals'], followUps: [] })
	})

	it('keeps text that appears after the meta block', () => {
		const result = run([`Answer.${META}\nP.S. keep moving!`])
		expect(result.text).toBe('Answer.\nP.S. keep moving!')
		expect(result.meta).not.toBeNull()
	})

	it('salvages an unterminated meta block without showing it', () => {
		const result = run(['Answer.<meta>{"citedMetrics":["steps"],"followUps":[]}'])
		expect(result.text).toBe('Answer.')
		expect(result.meta).toEqual({ citedMetrics: ['steps'], followUps: [] })
	})

	it('strips a stray closing tag', () => {
		expect(run(['Answer.</meta> done']).text).toBe('Answer. done')
		expect(run(['Answer.</me', 'ta> done']).text).toBe('Answer. done')
	})

	it('is case-insensitive about the tag', () => {
		const result = run(['A.<META>{"citedMetrics":["mood"]}</META>'])
		expect(result.text).toBe('A.')
		expect(result.meta).toEqual({ citedMetrics: ['mood'], followUps: [] })
	})

	it('uses the first valid block when there are several', () => {
		const result = run([
			'A.<meta>nope</meta><meta>{"citedMetrics":["steps"]}</meta><meta>{"citedMetrics":["mood"]}</meta>',
		])
		expect(result.text).toBe('A.')
		expect(result.meta?.citedMetrics).toEqual(['steps'])
	})
})

describe('parseMeta', () => {
	it('clamps follow-ups to 3 and drops empty or non-string ones', () => {
		const meta = parseMeta(
			JSON.stringify({ citedMetrics: [], followUps: ['a', ' ', 7, 'b', 'c', 'd'] }),
		)
		expect(meta?.followUps).toEqual(['a', 'b', 'c'])
	})

	it('filters unknown or duplicate cited metrics and unknown fields', () => {
		const meta = parseMeta(
			JSON.stringify({
				citedMetrics: ['steps', 'steps', 'bloodGlucose', 42, 'activities'],
				followUps: [],
				confidence: 0.9,
			}),
		)
		expect(meta).toEqual({ citedMetrics: ['steps', 'activities'], followUps: [] })
	})

	it('defaults missing arrays to empty', () => {
		expect(parseMeta('{}')).toEqual({ citedMetrics: [], followUps: [] })
	})

	it.each(['', 'null', '[1,2]', '{"citedMetrics":"steps"}', 'not json'])(
		'returns null for unusable input %j',
		(raw) => {
			expect(parseMeta(raw)).toBeNull()
		},
	)

	it('drops overly long follow-ups', () => {
		const meta = parseMeta(JSON.stringify({ followUps: ['x'.repeat(500), 'ok'] }))
		expect(meta?.followUps).toEqual(['ok'])
	})
})
