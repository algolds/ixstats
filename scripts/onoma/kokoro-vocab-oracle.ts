// scripts/onoma/kokoro-vocab-oracle.ts
// Dev script: dump Kokoro's valid English phoneme token set by feeding a word
// list through kokoro-fastapi's /dev/phonemize, then unioning every phoneme
// character the model returns. Use the printed inventory to seed/validate the
// KOKORO_VALID_TOKENS set and KOKORO_REMAP table in
// src/lib/onoma/kokoro-phonemes.ts.
//
// Run (container must be up, e.g.):
//   docker run -d --name kokoro-fastapi -p 8880:8880 \
//     ghcr.io/remsky/kokoro-fastapi-cpu:latest
//   KOKORO_FASTAPI_URL=http://localhost:8880 bunx tsx scripts/onoma/kokoro-vocab-oracle.ts
import { translateToIPA } from "../../src/lib/onoma/phonology";

const BASE = (process.env.KOKORO_FASTAPI_URL || "http://localhost:8880")
  .replace(/\/$/, "")
  .replace(/\/dev$/, "");

// A spread of Onoma-generated names across cultures so the phonemizer exercises
// a wide slice of its English vocabulary.
const WORDS = [
  "Imperia", "Vlachezar", "Adelhardt", "Caoimhe", "Rahmani", "Sakura",
  "Tane", "Aelith", "Novus Roma", "encyclopedia", "strength", "through",
  "queue", "rhythm", "asterisk", "knowledge", "christmas", "worcestershire",
];

interface PhonemizeResp {
  phonemes?: string | string[];
  tokens?: unknown;
}

async function phonemize(text: string): Promise<string> {
  const res = await fetch(`${BASE}/dev/phonemize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: "en-us" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`/dev/phonemize -> ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as PhonemizeResp;
  const ph = data.phonemes;
  return Array.isArray(ph) ? ph.join(" ") : typeof ph === "string" ? ph : "";
}

(async () => {
  const inventory = new Set<string>();
  console.log(`Querying ${BASE}/dev/phonemize with ${WORDS.length} words...\n`);

  for (const w of WORDS) {
    try {
      const ipa = await phonemize(w);
      for (const ch of ipa) inventory.add(ch);
      console.log(`${w.padEnd(16)} -> ${ipa}`);
    } catch (e) {
      console.error(`${w}: ${(e as Error).message}`);
    }
  }

  // Also feed Onoma's own IPA through so we can see which of its tokens the
  // phonemizer recognizes vs. normalizes away.
  console.log("\nOnoma IPA sanity (translateToIPA outputs):");
  for (const w of WORDS.slice(0, 9)) {
    const culture = ["latin", "slavic", "germanic", "celtic", "arabic", "east-asian", "austronesian", "constructed", "latin"][WORDS.slice(0, 9).indexOf(w)];
    console.log(`${w.padEnd(16)} -> ${translateToIPA(w, culture)}`);
  }

  const sorted = [...inventory].sort();
  console.log(`\nKokoro English phoneme char inventory (${sorted.length} unique):`);
  console.log(sorted.join(" "));
  console.log(
    "\nCopy any missing chars into KOKORO_VALID_TOKENS, and confirm remap " +
      "targets in src/lib/onoma/kokoro-phonemes.ts."
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
