/**
 * The seed stream (research §7.5 step 3). A seed is a hex string (the server's HMAC); this turns it into a
 * deterministic stream of uniforms (sfc32) and normals (Box–Muller), so a stored seed replays exactly.
 */

export interface SeedStream {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal. */
  normal(): number;
}

/** Four 32-bit words from a hex seed (repeated if short, so any non-empty seed works). */
function words(seedHex: string): [number, number, number, number] {
  const clean = seedHex.replace(/[^0-9a-f]/gi, "") || "0";
  const hex = clean.repeat(Math.ceil(32 / clean.length));
  const word = (i: number) => Number.parseInt(hex.slice(i * 8, i * 8 + 8).padEnd(8, "0"), 16) >>> 0;
  return [word(0), word(1), word(2), word(3)];
}

/** sfc32: a small, fast, well-distributed generator. */
export function seedStream(seedHex: string): SeedStream {
  let [a, b, c, d] = words(seedHex);
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Discard the first outputs: sfc32 mixes its state over a few rounds.
  for (let i = 0; i < 12; i++) next();
  const normal = () => {
    const u1 = Math.max(next(), 1e-12);
    const u2 = next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { next, normal };
}
