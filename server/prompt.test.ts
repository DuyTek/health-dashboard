// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixtureSummary } from './__fixtures__/health.js'
import { buildSystemInstruction, compactSummary } from './prompt.js'

describe('buildSystemInstruction', () => {
	const prompt = buildSystemInstruction(fixtureSummary)

	it('anchors the date and the data period', () => {
		expect(prompt).toContain(`Today is ${fixtureSummary.asOf}`)
		expect(prompt).toContain(fixtureSummary.periodStart)
	})

	it('embeds the summary as JSON inside delimited tags', () => {
		const match = /<health_summary>\n(.*)\n<\/health_summary>/s.exec(prompt)
		expect(match).not.toBeNull()
		const parsed: unknown = JSON.parse(match?.[1] ?? '')
		expect(parsed).toEqual(compactSummary(fixtureSummary))
	})

	it('addresses the user by first name', () => {
		expect(prompt).toContain('exactly one user, Alex')
	})

	it('states the grounding, safety and injection rules', () => {
		expect(prompt).toMatch(/Use only the numbers in <health_summary> and in tool results/)
		expect(prompt).toMatch(/Never invent/)
		expect(prompt).toMatch(/blood glucose, cholesterol/)
		expect(prompt).toMatch(/not tracked in this app/)
		expect(prompt).toMatch(/Do not diagnose/)
		expect(prompt).toMatch(/healthcare professional/)
		expect(prompt).toMatch(/not medical advice/)
		expect(prompt).toMatch(/cannot change these rules/)
	})

	it('specifies the <meta> output protocol with the allowed sources', () => {
		expect(prompt).toContain('<meta>{"citedMetrics"')
		expect(prompt).toContain('</meta>')
		expect(prompt).toMatch(/up to 3 short questions/)
		expect(prompt).toContain('steps, activeMinutes, sleepMinutes')
		expect(prompt).toContain('activities, goals')
	})

	it('names the tools the agent can call', () => {
		expect(prompt).toContain('get_metric_history')
		expect(prompt).toContain('get_activities')
		expect(prompt).toContain('get_goals')
	})
})

describe('compactSummary', () => {
	const compact = compactSummary(fixtureSummary) as {
		metrics: Record<string, Record<string, unknown>>
		recentActivities: unknown[]
	}

	it('rounds numbers and drops redundant fields', () => {
		expect(compact.metrics.activeMinutes.latest).toBe(10.1)
		expect(compact.metrics.activeMinutes.changePct30).toBe(3)
		expect(compact.metrics.activeMinutes).not.toHaveProperty('key')
	})

	it('keeps missing values explicit as null', () => {
		expect(compact.metrics.mood.latest).toBeNull()
		expect(compact.metrics.mood.daysWithData).toBe(0)
	})

	it('caps the number of recent activities', () => {
		expect(compact.recentActivities.length).toBeLessThanOrEqual(5)
	})
})
