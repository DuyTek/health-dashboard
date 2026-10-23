// Small seeded PRNG so the dataset is identical on every run, in the browser
// and on the server. Never use Math.random in src/data.

export type Rng = () => number

/** mulberry32: fast 32-bit seeded generator returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** Normally distributed sample (Box–Muller). */
export function gaussian(rng: Rng, mean = 0, sd = 1): number {
	const u = Math.max(rng(), 1e-12)
	const v = rng()
	return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function chance(rng: Rng, probability: number): boolean {
	return rng() < probability
}
