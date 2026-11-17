// Seedable pseudo-random number generator (Mulberry32)
// Ensures reproducible city generation, traffic distribution, and deterministic screenshot scenes.

export function createRandom(initialSeed = 1337) {
  let s = (initialSeed >>> 0) || 1;

  function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(next() * arr.length)];
  }

  function seed(newSeed) {
    s = (newSeed >>> 0) || 1;
  }

  return { next, range, int, choice, seed };
}
