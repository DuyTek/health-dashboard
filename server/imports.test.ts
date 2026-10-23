// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Vercel compiles api/*.ts to ESM per file without bundling, and Node's ESM
// loader does not add extensions. Every relative import reachable from the
// function must therefore name its `.js` file, and must not use `@/`.
const SERVER_REACHABLE = ['api', 'server', 'src/data', 'src/lib/health', 'src/types']

function tsFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return tsFiles(path)
		return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []
	})
}

const specifiers = /(?:from|import)\s*\(?\s*'([^']+)'/g

describe('server-reachable imports', () => {
	const files = SERVER_REACHABLE.flatMap(tsFiles)

	it('finds the modules to check', () => {
		expect(files.length).toBeGreaterThan(10)
	})

	it.each(files)('%s uses .js relative imports and no @/ alias', (file) => {
		const source = readFileSync(file, 'utf8')
		const bad = [...source.matchAll(specifiers)]
			.map((m) => m[1])
			.filter((spec) => spec.startsWith('@/') || (spec.startsWith('.') && !spec.endsWith('.js')))
		expect(bad).toEqual([])
	})
})
