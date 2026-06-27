// Audition kokoro-web pronunciation forms. Run:
//   KOKORO_BASE_URL=http://localhost:8888 \
//   KOKORO_API_KEY="$(docker exec kokoro-web env | grep -oP 'KW_SECRET_API_KEY=\K.*')" \
//   bunx tsx scripts/onoma/audition-voice.ts
import { mkdirSync, writeFileSync } from "fs";
import { translateToIPA } from "../../src/lib/onoma/phonology";
import { ipaToSpeechSpelling } from "../../src/lib/onoma/branding-utils";
import { ipaToKokoroPhonemes } from "../../src/lib/onoma/kokoro-phonemes";

const BASE = (process.env.KOKORO_BASE_URL || "http://localhost:8888")
  .replace(/\/$/, "")
  .replace(/\/api$/, "");
const KEY = process.env.KOKORO_API_KEY || "";
const FASTAPI_BASE = (process.env.KOKORO_FASTAPI_URL || "http://localhost:8880").replace(/\/$/, "");
const OUT = "scratch/onoma-audition";

const CASES: { name: string; culture: string }[] = [
  { name: "Imperia", culture: "latin" },
  { name: "Vlachezar", culture: "slavic" },
  { name: "Adelhardt", culture: "germanic" },
  { name: "Caoimhe", culture: "celtic" },
  { name: "Rahmani", culture: "arabic" },
];

const forms = (ipa: string, name: string) => {
  const spelled = ipaToSpeechSpelling(ipa);
  return {
    raw: name,
    spaced: spelled.toLowerCase().replace(/-/g, " "),
    joined: spelled.toLowerCase().replace(/-/g, ""),
  };
};

async function synth(input: string, file: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (KEY) headers["Authorization"] = `Bearer ${KEY}`;
  const res = await fetch(`${BASE}/api/v1/audio/speech`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "model_q8f16", voice: "af_heart", input, response_format: "mp3", speed: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for input="${input}"`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function synthPhonemes(phonemes: string, file: string) {
  const res = await fetch(`${FASTAPI_BASE}/dev/generate_from_phonemes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phonemes, voice: "af_heart", speed: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for phonemes="${phonemes}"`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const { name, culture } of CASES) {
    const ipa = translateToIPA(name, culture);
    const f = forms(ipa, name);
    console.log(`\n${name} (${culture})  ipa=${ipa}`);
    for (const [form, input] of Object.entries(f)) {
      const file = `${OUT}/${name}-${form}.mp3`;
      await synth(input as string, file);
      console.log(`  ${form.padEnd(10)} input="${input}"  -> ${file}`);
    }

    // Phoneme-path form via kokoro-fastapi (skip if container not running)
    try {
      const { phonemes } = ipaToKokoroPhonemes(ipa);
      if (phonemes) {
        const file = `${OUT}/${name}-phonemes.wav`;
        await synthPhonemes(phonemes, file);
        console.log(`  ${"phonemes".padEnd(10)} input="${phonemes}"  -> ${file}`);
      }
    } catch (err) {
      console.log(`  phonemes   (skipped – kokoro-fastapi not reachable: ${(err as Error).message})`);
    }
  }
  console.log(`\nListen to ${OUT}/ and decide: raw | spaced | joined | phonemes`);
  console.log("  spaced (default): no code change");
  console.log("  joined: change ipaToSpokenText replace(/-/g, ' ') -> replace(/-/g, '') and update test");
  console.log("  raw wins: revert route.ts `const input = ipaToSpokenText(ipa) || text` to `const input = text`");
  console.log("  phonemes: use kokoro-fastapi /dev/generate_from_phonemes (best fidelity, needs fastapi container)");
})();
