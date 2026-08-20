# Plan 125: Fix Onoma Production BasePath Routing, Server Batch Dynamic Require, and IPA Leading Hesitation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/lib/onoma/ src/server/api/routers/onoma/ src/app/api/onoma/ src/app/admin/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7508ff4d`, 2026-08-18
- **Status**: DONE

## Why this matters

In production environments deployed at a subpath (`/projects/ixstates`), client calls to `/api/onoma/tts` bypass the application `basePath`, resulting in 404 network errors when synthesizing natural Kokoro voice. Concurrently, the server-side batch router uses a dynamic `require('~/lib/onoma/...')` with the TypeScript path alias `~`, which fails in server runtimes where Node's CJS module resolver does not understand tsconfig path aliases. Lastly, the phonetic re-speller and vowel anglicizer prematurely reduce unstressed initial vowels (`a`, `e`, `o`) to schwa (`ə` / `"uh"` / `"eh"`), producing unnatural hesitation sounds ("uh-NOH-muh") at the start of generated names. Fixing these ensures clean, production-ready speech synthesis and server batch generation.

## Current state

- `src/lib/onoma/browser-speech.ts:185`:
  ```typescript
  const res = await fetch(`/api/onoma/tts?${params.toString()}`);
  ```
  Lacks `withBasePath(...)`, breaking when the app runs under `/projects/ixstates`.
- `src/app/admin/_components/OnomaAdminPanel.tsx:154`:
  ```typescript
  const res = await fetch("/api/onoma/tts", { ... });
  ```
  Lacks `withBasePath(...)`.
- `src/server/api/routers/onoma/batch.ts:143`:
  ```typescript
  const lexiconModule = require(`~/lib/onoma/data/lexicon/${lexiconCat}.json`);
  ```
  Dynamic CJS require with `~` alias fails at runtime in Node.
- `src/lib/onoma/branding-utils.ts:118,124-125` & `src/lib/onoma/kokoro-phonemes.ts:202-211`:
  Unstressed word-initial cardinal vowels are aggressively reduced to schwa `ə`, and `IPA_RESPELL` maps `ə` to `"uh"` and `e` to `"eh"`, causing syllable splitters (`ipaToSpeechSpelling`) to output `"uh-..."` or `"eh-..."` at the start of words.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/onoma/browser-speech.ts`
- `src/app/admin/_components/OnomaAdminPanel.tsx`
- `src/server/api/routers/onoma/batch.ts`
- `src/lib/onoma/branding-utils.ts`
- `src/lib/onoma/kokoro-phonemes.ts`
- `src/lib/onoma/branding-utils.test.ts`
- `src/lib/onoma/kokoro-phonemes.test.ts`

**Out of scope**:
- Direct modifications to Docker Kokoro backend services.
- Renaming existing Prisma models or database migrations.

## Git workflow

- Branch: `advisor/125-onoma-basepath-and-speech-fixes`
- Commit style: `fix(onoma): <summary>`

## Steps

### Step 1: Wrap TTS API Fetch Calls with `withBasePath`

In `src/lib/onoma/browser-speech.ts` and `src/app/admin/_components/OnomaAdminPanel.tsx`:
1. Import `withBasePath` from `~/lib/base-path`.
2. Wrap `/api/onoma/tts` with `withBasePath(...)`.

In `src/lib/onoma/browser-speech.ts`:
```typescript
import { withBasePath } from "~/lib/base-path";
// ...
const res = await fetch(withBasePath(`/api/onoma/tts?${params.toString()}`));
```

In `src/app/admin/_components/OnomaAdminPanel.tsx`:
```typescript
import { withBasePath } from "~/lib/base-path";
// ...
const res = await fetch(withBasePath("/api/onoma/tts"), { ... });
```

**Verify**: `bun run test -- src/lib/onoma/browser-speech.test.ts` → exit 0

### Step 2: Replace Dynamic Alias Require in Batch Router

In `src/server/api/routers/onoma/batch.ts`:
Replace the dynamic `require('~/lib/onoma/...')` with a static map of dynamic JSON imports or relative dictionary resolution matching `useOnomaGenerator.ts`:

```typescript
const LEXICON_LOADERS: Record<string, () => Promise<{ default: Record<string, string[]> }>> = {
  country: () => import("~/lib/onoma/data/lexicon/country.json"),
  city: () => import("~/lib/onoma/data/lexicon/city.json"),
  province: () => import("~/lib/onoma/data/lexicon/province.json"),
  person: () => import("~/lib/onoma/data/lexicon/person.json"),
  organization: () => import("~/lib/onoma/data/lexicon/organization.json"),
  culture_generic: () => import("~/lib/onoma/data/lexicon/culture_generic.json"),
  culture_sports: () => import("~/lib/onoma/data/lexicon/culture_sports.json"),
  culture_cuisine: () => import("~/lib/onoma/data/lexicon/culture_cuisine.json"),
  culture_architecture: () => import("~/lib/onoma/data/lexicon/culture_architecture.json"),
};
```

In `batchGenerate` procedure:
```typescript
if (trainingMode === "lexicon") {
  const lexiconCat = mapCategoryForLexicon(category, input.subType);
  const loader = LEXICON_LOADERS[lexiconCat];
  if (loader) {
    const mod = await loader();
    const lexiconDict = mod.default ?? (mod as unknown as Record<string, string[]>);
    if (culture === "any") {
      lexiconSeeds.push(...Object.values(lexiconDict).flat());
    } else if (culture !== "constructed" && lexiconDict[culture]) {
      lexiconSeeds.push(...(lexiconDict[culture] || []));
    }
  }
}
```

**Verify**: `bun run test -- src/lib/onoma` → exit 0

### Step 3: Eliminate Leading "uh/eh" Vocalization from IPA Re-speller & Anglicizer

In `src/lib/onoma/kokoro-phonemes.ts`:
1. Prevent word-initial vowels from defaulting to unstressed `ə` if they occur before the primary stress mark. Preserve word-initial vowels (`a`, `e`, `o`) in open syllables so they don't sound like hesitation grunts.
2. In `anglicizeForSpeech`:
```typescript
// Word-initial cardinal vowel preservation
if (i === 0 || (i === 1 && (ipa[0] === "/" || ipa[0] === "["))) {
  // First vowel of the word — preserve clear vowel onset instead of reducing to schwa
  if (ch === "e") out += "ɛ";
  else if (ch === "o") out += "oʊ";
  else if (ch === "a") out += "ɑ";
  else out += ch;
  i++;
  continue;
}
```

In `src/lib/onoma/branding-utils.ts`:
1. In `ipaToSpeechSpelling`, clean up syllable chunking for word-initial vowel onsets so they merge with the subsequent consonant onset rather than standing alone as isolated `"uh-"` or `"eh-"` syllables.
2. Adjust `IPA_RESPELL` so initial `ə` maps cleanly to natural vowel values rather than interjection words.

**Verify**: `bun run test -- src/lib/onoma/kokoro-phonemes.test.ts src/lib/onoma/branding-utils.test.ts` → all pass

## Test plan

- Test `anglicizeForSpeech("/ˈdelepas/")` → `ˈdɛləpəs` (vowels in middle syllables reduce to schwa, not initial).
- Test `anglicizeForSpeech("/onoma/")` → `oʊnəmə` (word-initial 'o' does NOT become 'ə').
- Test `ipaToSpeechSpelling("/oʊˈnoʊmə/")` → `"oh-NOH-muh"` (not `"uh-NOH-muh"`).
- Test `batchGenerate` with `trainingMode: "lexicon"` and ensure no `MODULE_NOT_FOUND` errors.

## Done criteria

- [ ] All `fetch("/api/onoma/tts")` calls wrapped with `withBasePath`
- [ ] `batch.ts` uses static ESM import loaders without runtime `require`
- [ ] Initial vowels in IPA speech synthesizer do not introduce "uh/eh" hesitation sounds
- [ ] `bun run test -- src/lib/onoma` passes with 0 failures
- [ ] Status updated in `plans/README.md`

## STOP conditions

- If `withBasePath` produces double prefixing in test mocks, verify `BASE_PATH` environment isolation.
- If Kokoro phoneme tests fail on custom phoneme tokens, ensure `KOKORO_VALID_TOKENS` contains the mapped replacements.
