# Onoma IPA-Steered Natural Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 🎙 Read Naturally (kokoro-web) voice pronounce names from Onoma's IPA — including per-name and per-culture overrides — by re-spelling IPA into clean English syllables and feeding that to kokoro-web.

**Architecture:** kokoro-web's REST API only does English G2P on plain text (no phoneme input). So we convert the resolved IPA into an English re-spelling that English G2P reproduces, and send that as the spoken text. The existing client already resolves overrides (per-name → per-culture → base) into the IPA string it passes to the TTS proxy, so steering the natural voice is a matter of (a) fixing the re-speller's syllabification and (b) having the route speak the re-spelling instead of the raw name. The current syllabifier is rewritten to operate on phoneme **chunks** (so the `h` in `oh`/`eh` is not mistaken for a consonant), which fixes both the natural voice and the browser fallback at once.

**Tech Stack:** TypeScript, Next.js App Router API route, Jest 30, `bun run test`, kokoro-web (`ghcr.io/eduardolat/kokoro-web`) at `/api/v1/audio/speech`.

## Global Constraints

- Package manager: `bun` exclusively. Run tests with `bun run test -- <path>`.
- Never run `tsc --noEmit` / `bun run typecheck:full`. Use `bun run typecheck:file <path>` or `bun run typecheck:server`.
- No new dependencies. No DB migration. No new tRPC endpoints.
- kokoro-web speech endpoint: `POST {baseUrl}/api/v1/audio/speech`, body `{ model, voice, input, response_format:"mp3", speed }`. Its markdown phoneme syntax `[w](/ipa/)` is UI-only and is read literally by the API — never send it.
- `ipaToSpeechSpelling` output format (hyphenated, stressed-syllable uppercased, e.g. `shuh-NOH-muh`) is contractual — existing tests depend on it. Keep that format; only fix correctness.
- Re-spelling cannot convey stress to kokoro (TTS ignores letter case); accuracy is limited to vowel/consonant quality. This is acceptable.

---

### Task 1: Rewrite the IPA re-speller on phoneme chunks

Replace the letter-based syllabifier in `ipaToSpeechSpelling` with a chunk-based one. A "chunk" is one IPA token mapped to its English re-spelling, tagged as vowel or consonant. Syllabifying on chunks stops the `h` inside `ih`/`eh`/`oh`/`uh`/`ah` from being counted as a consonant (the bug behind `/ɪmˈpɛɾia/` → `ih MPEH reea h`).

**Files:**
- Modify: `src/lib/onoma/branding-utils.ts:65-227` (replace the body of `ipaToSpeechSpelling` and add the two private helpers + the vowel set)
- Test: `src/lib/onoma/branding-utils.test.ts` (new file)

**Interfaces:**
- Produces: `ipaToSpeechSpelling(ipa: string): string` — same signature and output format as today, with corrected syllabification. Multi-word input (spaces/hyphens) is re-spelled per word with separators preserved.

- [ ] **Step 1: Write failing tests for the corrected syllabification**

Create `src/lib/onoma/branding-utils.test.ts`:

```ts
import { ipaToSpeechSpelling } from "./branding-utils";

describe("ipaToSpeechSpelling (chunk-based)", () => {
  it("keeps the existing contract", () => {
    expect(ipaToSpeechSpelling("/ʃəˈnoʊmə/")).toBe("shuh-NOH-muh");
    expect(ipaToSpeechSpelling("[laˈtiːn]")).toBe("lah-TEEN");
    expect(ipaToSpeechSpelling("/θəˈðə/")).toBe("thuh-THUH");
    expect(ipaToSpeechSpelling("/dʒeɪ/")).toBe("JAY");
    expect(ipaToSpeechSpelling("ʃ")).toBe("SH");
    expect(ipaToSpeechSpelling("/aɪ/")).toBe("EYE");
    expect(ipaToSpeechSpelling("")).toBe("");
  });

  it("does not treat the h in vowel digraphs as a consonant", () => {
    // was the choppy "ih-MPEH-reea-h"
    expect(ipaToSpeechSpelling("/ɪmˈpɛɾia/")).toBe("ihm-PEH-ree-ah");
    // was "EH-ksahmpl"
    expect(ipaToSpeechSpelling("/ˈeksɑːmpl/")).toBe("EHK-sahmpl");
  });

  it("re-spells each word and preserves separators", () => {
    expect(ipaToSpeechSpelling("/ˈnoʊvə ˈroʊma/")).toBe("NOH-vuh ROH-mah");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- src/lib/onoma/branding-utils.test.ts`
Expected: FAIL (the new cases assert the corrected output; current code yields the choppy strings).

- [ ] **Step 3: Replace `ipaToSpeechSpelling` with the chunk-based implementation**

In `src/lib/onoma/branding-utils.ts`, replace the entire existing `ipaToSpeechSpelling` function (and its old inline `ipaMap`/syllabifier) with:

```ts
// IPA tokens that act as syllable nuclei (vowels & diphthongs).
const IPA_VOWEL_TOKENS = new Set([
  "aɪ", "eɪ", "aʊ", "ɔɪ", "oʊ", "iː", "uː", "ɑː", "ɔː",
  "ø", "œ", "ɛ", "ɔ", "ə", "æ", "y", "ʌ", "ɪ", "ʊ", "a", "e", "i", "o", "u",
]);

// IPA token → English re-spelling chunk. Longest tokens first (the scanner takes the first match).
const IPA_RESPELL: [string, string][] = [
  ["aɪ", "eye"], ["eɪ", "ay"], ["aʊ", "ow"], ["ɔɪ", "oy"], ["oʊ", "oh"],
  ["iː", "ee"], ["uː", "oo"], ["ɑː", "ah"], ["ɔː", "aw"],
  ["tʃ", "ch"], ["dʒ", "j"], ["ts", "ts"], ["ks", "ks"], ["kw", "kw"],
  ["θ", "th"], ["ð", "th"], ["ʃ", "sh"], ["ʒ", "zh"], ["ŋ", "ng"],
  ["ʁ", "r"], ["ɣ", "gh"], ["ɬ", "l"], ["ɾ", "r"], ["x", "kh"], ["ʔ", ""],
  ["ø", "ur"], ["œ", "ur"], ["ɛ", "eh"], ["ɔ", "aw"], ["ə", "uh"], ["æ", "ah"],
  ["y", "ew"], ["ʌ", "uh"], ["ɪ", "ih"], ["ʊ", "uu"],
  ["a", "ah"], ["e", "eh"], ["i", "ee"], ["o", "oh"], ["u", "oo"],
];

interface RespellChunk {
  text: string;
  vowel: boolean;
}

/** Tokenize one IPA word into re-spelled chunks, recording which chunk is the stressed nucleus. */
function chunkIpaWord(word: string): { chunks: RespellChunk[]; stressChunk: number } {
  const stressPos = word.indexOf("ˈ");
  const removedBefore = stressPos < 0 ? 0 : (word.slice(0, stressPos).match(/[ˈˌ]/g) || []).length;
  const cleanStressPos = stressPos < 0 ? -1 : stressPos - removedBefore;
  const clean = word.replace(/[ˈˌ]/g, "");

  const chunks: RespellChunk[] = [];
  let stressChunk = -1;
  let sawStress = false;
  let i = 0;
  while (i < clean.length) {
    if (cleanStressPos >= 0 && i >= cleanStressPos) sawStress = true;
    let tok = clean[i];
    let rep = clean[i];
    for (const [t, r] of IPA_RESPELL) {
      if (clean.startsWith(t, i)) {
        tok = t;
        rep = r;
        break;
      }
    }
    const vowel = IPA_VOWEL_TOKENS.has(tok);
    if (rep) chunks.push({ text: rep, vowel });
    if (sawStress && vowel && stressChunk === -1) stressChunk = chunks.length - 1;
    i += tok.length;
  }
  return { chunks, stressChunk };
}

/** Group chunks into syllables — one nucleus each; a single intervocalic consonant is the next onset. */
function syllabifyChunks(chunks: RespellChunk[]): { text: string; start: number; end: number }[] {
  const vowels: number[] = [];
  chunks.forEach((c, idx) => {
    if (c.vowel) vowels.push(idx);
  });
  const join = (s: number, e: number) => chunks.slice(s, e).map((c) => c.text).join("");
  if (vowels.length === 0) return [{ text: join(0, chunks.length), start: 0, end: chunks.length }];

  const out: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (let v = 0; v < vowels.length; v++) {
    let end: number;
    if (v === vowels.length - 1) {
      end = chunks.length;
    } else {
      const between = vowels[v + 1] - vowels[v] - 1;
      // 0–1 consonants → coda stays with this vowel; 2+ → last consonant becomes the next onset.
      end = between <= 1 ? vowels[v] + 1 : vowels[v + 1] - 1;
    }
    out.push({ text: join(start, end), start, end });
    start = end;
  }
  return out;
}

/**
 * Translates an IPA transcription into a phonetically readable English re-spelling for TTS.
 * The stressed syllable is upper-cased; syllables are hyphen-joined.
 *
 * Example: "/ʃəˈnoʊmə/" → "shuh-NOH-muh"
 */
export function ipaToSpeechSpelling(ipa: string): string {
  if (!ipa) return "";
  const cleaned = ipa.replace(/[/\[\]]/g, "").trim();
  if (!cleaned) return "";

  const parts = cleaned.split(/(\s+|-)/); // keep spaces/hyphens as separators
  return parts
    .map((part) => {
      if (!part || /^(\s+|-)$/.test(part)) return part;
      const { chunks, stressChunk } = chunkIpaWord(part);
      const sylls = syllabifyChunks(chunks);
      if (sylls.length <= 1) return sylls.map((s) => s.text).join("").toUpperCase();
      let anyStressed = false;
      const rendered = sylls.map((s) => {
        const stressed = stressChunk >= s.start && stressChunk < s.end;
        if (stressed) anyStressed = true;
        return stressed ? s.text.toUpperCase() : s.text.toLowerCase();
      });
      if (!anyStressed && rendered.length > 0) rendered[0] = rendered[0].toUpperCase();
      return rendered.join("-");
    })
    .join("");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- src/lib/onoma/branding-utils.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Run the legacy re-speller test to confirm no regression**

Run: `bun run test -- src/lib/onoma/browser-speech.test.ts`
Expected: PASS (it imports `ipaToSpeechSpelling` and asserts the same contract strings).

- [ ] **Step 6: Typecheck the file**

Run: `bun run typecheck:file src/lib/onoma/branding-utils.ts`
Expected: No errors originating in `branding-utils.ts` (ignore `Cannot find module '~/...'` single-file-mode noise).

- [ ] **Step 7: Commit**

```bash
git add src/lib/onoma/branding-utils.ts src/lib/onoma/branding-utils.test.ts
git commit -m "fix(onoma): chunk-based IPA syllabifier for clean re-spelling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add `ipaToSpokenText` for the natural voice

A thin adapter that turns the hyphenated re-spelling into the form kokoro-web should speak. Default to space-separated, lower-cased (no stress caps, since TTS ignores case). The exact separator is finalized by audition in Task 4.

**Files:**
- Modify: `src/lib/onoma/branding-utils.ts` (add the export after `ipaToSpeechSpelling`)
- Test: `src/lib/onoma/branding-utils.test.ts` (extend)

**Interfaces:**
- Consumes: `ipaToSpeechSpelling` (Task 1).
- Produces: `ipaToSpokenText(ipa: string): string` — re-spelling suitable as kokoro-web `input`; returns `""` for empty/blank IPA.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/onoma/branding-utils.test.ts`:

```ts
import { ipaToSpokenText } from "./branding-utils";

describe("ipaToSpokenText", () => {
  it("lower-cases and space-separates the re-spelling for kokoro", () => {
    expect(ipaToSpokenText("/ʃəˈnoʊmə/")).toBe("shuh noh muh");
  });
  it("returns empty for blank IPA", () => {
    expect(ipaToSpokenText("")).toBe("");
    expect(ipaToSpokenText("//")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- src/lib/onoma/branding-utils.test.ts -t ipaToSpokenText`
Expected: FAIL with "ipaToSpokenText is not a function".

- [ ] **Step 3: Implement `ipaToSpokenText`**

Add to `src/lib/onoma/branding-utils.ts`:

```ts
/**
 * Re-spelling formatted for kokoro-web's text input (it can't take raw phonemes).
 * Stress caps are dropped because TTS ignores letter case; syllables are space-separated.
 */
export function ipaToSpokenText(ipa: string): string {
  const spelled = ipaToSpeechSpelling(ipa);
  if (!spelled) return "";
  return spelled.toLowerCase().replace(/-/g, " ");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- src/lib/onoma/branding-utils.test.ts -t ipaToSpokenText`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onoma/branding-utils.ts src/lib/onoma/branding-utils.test.ts
git commit -m "feat(onoma): add ipaToSpokenText for kokoro natural voice

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Route the natural voice through the re-spelling

Speak the re-spelled IPA instead of the raw name. Because the client passes the override-resolved IPA in the `ipa` param, per-name and per-culture overrides steer the natural voice with no further plumbing.

**Files:**
- Modify: `src/app/api/onoma/tts/route.ts:1-9` (import) and the input-construction block (~line 146)
- Test: `src/app/api/onoma/tts/__tests__/route.test.ts` (extend)

**Interfaces:**
- Consumes: `ipaToSpokenText` (Task 2).
- Produces: TTS proxy whose kokoro `input` is `ipaToSpokenText(ipa) || text`.

- [ ] **Step 1: Add the import**

In `src/app/api/onoma/tts/route.ts`, below the `system-owner-constants` import:

```ts
import { ipaToSpokenText } from "~/lib/onoma/branding-utils";
```

- [ ] **Step 2: Replace the input-construction block**

Replace this block (currently sends the raw name):

```ts
    // kokoro-web's REST API only does English G2P on plain text — its markdown phoneme syntax is
    // a UI-only feature that the API reads out literally ("slash", "stress", …). So send the name
    // itself for a clean, natural reading. Onoma's IPA still drives the 🔊 phonetic badge, the
    // browser-speech path, and the on-screen transcription.
    //
    // ponytail: IPA-accurate natural voice would require re-spelling IPA → English syllables
    // (ipaToSpeechSpelling); the current syllabifier is too choppy to use here. Revisit if we
    // want the natural voice to follow custom IPA.
    const input = text;
    const contentType = "audio/mpeg";
```

with:

```ts
    // kokoro-web's REST API only does English G2P on plain text (its markdown phoneme syntax is
    // UI-only and would be read out literally). To make the natural voice follow Onoma's IPA —
    // including per-name / per-culture overrides, which the client has already resolved into the
    // `ipa` param — we speak the IPA re-spelled into English syllables. Falls back to the raw name.
    const input = ipaToSpokenText(ipa) || text;
    const contentType = "audio/mpeg";
```

- [ ] **Step 3: Add a route test asserting the re-spelled input is sent to kokoro**

Open `src/app/api/onoma/tts/__tests__/route.test.ts`, read its existing mocking style, and add a test that the outgoing kokoro request body's `input` equals `ipaToSpokenText(ipa)` when `ipa` is supplied. Use the file's existing `fetch` mock and config mock. Concretely, assert the body sent to `.../api/v1/audio/speech`:

```ts
it("speaks the re-spelled IPA, not the raw name", async () => {
  // arrange: config enabled with baseUrl, fetch mock capturing the request body
  // (reuse this file's existing helpers/mocks for auth, config, and fetch)
  const res = await POST(makeJsonRequest({ text: "Imperia", ipa: "/ɪmˈpɛɾia/" }));
  expect(res.status).toBe(200);
  const sent = JSON.parse(capturedKokoroRequest.body as string);
  expect(sent.input).toBe("ihm peh ree ah"); // ipaToSpokenText("/ɪmˈpɛɾia/")
  expect(sent.input).not.toContain("/"); // never sends slashes
});
```

Adapt `makeJsonRequest`, `capturedKokoroRequest`, auth/config mocks to match the helpers already present in the test file. If the file has no fetch-capturing helper, add a `global.fetch = jest.fn()` that records the second argument and returns `{ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }`.

- [ ] **Step 4: Run the route tests**

Run: `bun run test -- src/app/api/onoma/tts/__tests__/route.test.ts`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Manually verify overrides steer the voice**

Run the dev server (`bun run dev`), open `/labs/onoma`, generate a name, click 🎙 Read Naturally → confirm it speaks the re-spelling (not "slash"). Then open the badge pencil, set a custom IPA, Save, and 🎙 again → confirm the pronunciation changes to follow the override. In the IPA Studio, add a culture rule (e.g. Latin `v → w`), generate a Latin name with `v`, and confirm 🎙 reflects it.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/onoma/tts/route.ts src/app/api/onoma/tts/__tests__/route.test.ts
git commit -m "feat(onoma): steer kokoro natural voice with resolved IPA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Audition harness and final separator decision

We cannot judge TTS quality from code. This builds a small script that synthesizes a representative set through kokoro-web in each candidate form (space-separated, joined, raw name) so a human can pick the best, then locks that choice into `ipaToSpokenText`.

**Files:**
- Create: `scripts/onoma/audition-voice.ts`
- Modify (only if audition says so): `src/lib/onoma/branding-utils.ts` (the `.replace(/-/g, " ")` separator in `ipaToSpokenText`)

**Interfaces:**
- Consumes: `translateToIPA` (`~/lib/onoma/phonology`), `ipaToSpeechSpelling` (Task 1).
- Produces: MP3 files under `scratch/onoma-audition/` and a printed comparison table. Reads `KOKORO_BASE_URL` and `KOKORO_API_KEY` from env.

- [ ] **Step 1: Write the audition script**

Create `scripts/onoma/audition-voice.ts`:

```ts
// Audition kokoro-web pronunciation forms. Run:
//   KOKORO_BASE_URL=http://localhost:8888 \
//   KOKORO_API_KEY="$(docker exec kokoro-web env | grep -oP 'KW_SECRET_API_KEY=\K.*')" \
//   bunx tsx scripts/onoma/audition-voice.ts
import { mkdirSync, writeFileSync } from "fs";
import { translateToIPA } from "../../src/lib/onoma/phonology";
import { ipaToSpeechSpelling } from "../../src/lib/onoma/branding-utils";

const BASE = (process.env.KOKORO_BASE_URL || "http://localhost:8888").replace(/\/$/, "").replace(/\/api$/, "");
const KEY = process.env.KOKORO_API_KEY || "";
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
  const res = await fetch(`${BASE}/api/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({ model: "model_q8f16", voice: "af_heart", input, response_format: "mp3", speed: 1 }),
  });
  if (!res.ok) throw new Error(`${res.status} for "${input}"`);
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
      await synth(input, file);
      console.log(`  ${form.padEnd(7)} input="${input}"  -> ${file}`);
    }
  }
  console.log(`\nListen to the files in ${OUT}/ and pick raw vs spaced vs joined.`);
})();
```

- [ ] **Step 2: Run the harness**

Run:
```bash
KOKORO_BASE_URL=http://localhost:8888 \
KOKORO_API_KEY="$(docker exec kokoro-web env | grep -oP 'KW_SECRET_API_KEY=\K.*')" \
bunx tsx scripts/onoma/audition-voice.ts
```
Expected: prints a table and writes MP3s to `scratch/onoma-audition/`. If kokoro is on a different host/key, set the env vars accordingly.

- [ ] **Step 3: Audition and decide (human gate)**

Listen to `raw`, `spaced`, `joined` for each case. Pick the form that most accurately and naturally pronounces the names. Record the decision in the commit message. Decision rule:
- If **spaced** wins → no code change (it is the default).
- If **joined** wins → change `ipaToSpokenText`'s `.replace(/-/g, " ")` to `.replace(/-/g, "")` and update the Task 2 test expectation from `"shuh noh muh"` to `"shuhnohmuh"`, then rerun `bun run test -- src/lib/onoma/branding-utils.test.ts`.
- If **raw name** consistently wins (re-spelling never helps) → revert Task 3's input line to `const input = text;` and stop; the natural voice stays raw-name and IPA steers only the browser path. Note this outcome in the commit.

- [ ] **Step 4: Apply the decision (only if not "spaced")**

If joined: edit `src/lib/onoma/branding-utils.ts` and `src/lib/onoma/branding-utils.test.ts` per Step 3, then:
Run: `bun run test -- src/lib/onoma/branding-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/onoma/audition-voice.ts src/lib/onoma/branding-utils.ts src/lib/onoma/branding-utils.test.ts
git commit -m "feat(onoma): voice audition harness; lock spoken-text form to <chosen>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint the touched files**

Run:
```bash
bunx eslint src/lib/onoma/branding-utils.ts src/app/api/onoma/tts/route.ts scripts/onoma/audition-voice.ts
```
Expected: 0 errors (pre-existing warnings in `route.ts` for `defaultModel/defaultVoice/defaultSpeed` and the caught `e` are acceptable).

- [ ] **Step 2: Run the full onoma-related test set**

Run: `bun run test -- src/lib/onoma/branding-utils.test.ts src/lib/onoma/browser-speech.test.ts src/app/api/onoma/tts/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Server typecheck**

Run: `bun run typecheck:server 2>&1 | grep -E "branding-utils|error TS" | head`
Expected: no `error TS` lines in `branding-utils.ts` (pre-existing errors in unrelated files like `cosmetics.ts`, `cultural-profiles.ts` may appear — ignore).

- [ ] **Step 4: Confirm the browser fallback still works**

With kokoro disabled (toggle off in `/admin` Onoma panel, or stop the container), click 🔊 and 🎙 — both should fall back to the browser voice reading the improved re-spelling without errors.

---

## Notes / Out of Scope

- **Stress:** kokoro/TTS won't honor the uppercased stressed syllable (case-insensitive). Conveying stress would require SSML the API doesn't expose — out of scope.
- **No admin toggle:** if audition shows re-spelling helps, it's on for everyone; if it doesn't, Task 4 Step 3 reverts to raw-name. A per-deployment toggle is YAGNI unless results are genuinely mixed across voices.
- **Override flow is unchanged:** `resolveIpa` (per-name → per-culture → base) already runs client-side and the resolved IPA is what reaches the route, so no override-specific code is needed here.
```
