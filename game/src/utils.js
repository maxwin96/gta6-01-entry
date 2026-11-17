// Small math and random helpers used across the game. No dependencies.

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference from `from` to `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(angle) {
  return angleDelta(0, angle);
}

/** Distance on the ground plane (ignores y). */
export function flatDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// A tiny deterministic generator (mulberry32) so the city layout and
// traffic are the same for a given seed — screenshots stay reproducible.
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of an array using the given rng. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Format a money amount as "$1,200". */
export function formatMoney(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

/** Format a clock time (minutes since midnight) as "14:35". */
export function formatClock(minutes) {
  const total = Math.floor(minutes) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
