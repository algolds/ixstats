# Plan 131: Onoma Feature — Real-Time IPA Formant & Acoustic Spectrogram Visualizer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx src/lib/onoma/phonology.ts`

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/129-onoma-apple-motion-and-facets-refinement.md
- **Category**: direction
- **Planned at**: commit `7508ff4d`, 2026-08-18

## Why this matters

Phonology in conlanging is fundamentally acoustic. Conlangers balance vowel distributions across the vowel space ($F_1$ vowel height / openness vs $F_2$ vowel frontness/backness). Currently, IPA Studio shows only static text rules. Adding a real-time Web Audio API FFT acoustic spectrogram and an interactive 2D IPA Vowel Quadrilateral ($F_1/F_2$ formant plot) gives immediate visual feedback on the acoustic resonance and phonological balance of generated names when spoken.

## Current state

- `src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx`:
  Contains rule editors and phonetic translations, but no acoustic audio visualization or formant charts.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/app/labs/onoma/components/sections/studio/AcousticFormantVisualizer.tsx` (CREATE)
- `src/lib/onoma/vowel-formants.ts` (CREATE: $F_1/F_2$ IPA vowel coordinates)
- `src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx` (Integrate visualizer)

**Out of scope**:
- Server-side Python audio processing libraries.

## Git workflow

- Branch: `feature/onoma-formant-spectrogram`
- Commit style: `feat(onoma): <summary>`

## Steps

### Step 1: Create Vowel Formant Coordinate Mapping in `src/lib/onoma/vowel-formants.ts`

Create `src/lib/onoma/vowel-formants.ts`:
Standard acoustic phonetics reference frequencies (in Hz):
- `/i/`: $F_1 = 280, F_2 = 2250$ (High Front)
- `/e/`: $F_1 = 400, F_2 = 1900$ (Mid Front)
- `/ɛ/`: $F_1 = 550, F_2 = 1750$ (Open-Mid Front)
- `/a/`: $F_1 = 750, F_2 = 1500$ (Low Central)
- `/ɑ/`: $F_1 = 700, F_2 = 1100$ (Low Back)
- `/o/`: $F_1 = 450, F_2 = 950$ (Mid Back)
- `/u/`: $F_1 = 300, F_2 = 800$ (High Back)
- `/ə/`: $F_1 = 500, F_2 = 1400$ (Schwa / Central)

```typescript
export interface VowelFormant {
  ipa: string;
  f1: number; // Hz (Height: higher value = lower jaw)
  f2: number; // Hz (Frontness: higher value = fronter tongue)
  label: string;
}

export const IPA_VOWEL_FORMANTS: Record<string, VowelFormant> = {
  i: { ipa: "i", f1: 280, f2: 2250, label: "Close Front" },
  e: { ipa: "e", f1: 400, f2: 1900, label: "Close-Mid Front" },
  ɛ: { ipa: "ɛ", f1: 550, f2: 1750, label: "Open-Mid Front" },
  a: { ipa: "a", f1: 750, f2: 1500, label: "Open Central" },
  ɑ: { ipa: "ɑ", f1: 700, f2: 1100, label: "Open Back" },
  o: { ipa: "o", f1: 450, f2: 950, label: "Close-Mid Back" },
  u: { ipa: "u", f1: 300, f2: 800, label: "Close Back" },
  ə: { ipa: "ə", f1: 500, f2: 1400, label: "Mid Central" },
};

export function extractVowelsFromIpa(ipa: string): VowelFormant[] {
  const clean = ipa.replace(/[/[\]ˈˌː]/g, "");
  const found: VowelFormant[] = [];
  for (const ch of clean) {
    if (IPA_VOWEL_FORMANTS[ch]) {
      found.push(IPA_VOWEL_FORMANTS[ch]!);
    }
  }
  return found;
}
```

### Step 2: Build `AcousticFormantVisualizer.tsx`

Create `src/app/labs/onoma/components/sections/studio/AcousticFormantVisualizer.tsx`:
1. Canvas 1: **IPA Vowel Quadrilateral (2D Chart)**:
   - X-axis: $F_2$ (inverted: 2500Hz on left, 700Hz on right)
   - Y-axis: $F_1$ (inverted: 200Hz on top, 900Hz on bottom)
   - Plots active vowels from current word in glowing theme color with connection paths.
2. Canvas 2: **Real-Time FFT Audio Spectrogram**:
   - Uses Web Audio API `AudioContext` and `AnalyserNode` connected during speech playback.
   - Renders dynamic audio frequency waves with Facet frosted styling.

### Step 3: Embed in `StudioPhonology.tsx`

In `src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx`:
Mount `<AcousticFormantVisualizer currentIpa={ipa} />` alongside the IPA rule translation panel.

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Test plan

- Test vowel extraction: `/ˈkɑ.tə/` extracts `[ɑ, ə]`.
- Test visualizer renders in all major browsers without requiring microphone permissions (uses output audio stream / synthesis event).
- Test layout scales responsively across desktop and tablet views.

## Done criteria

- [x] Interactive 2D $F_1/F_2$ vowel quadrilateral plotted on SVG/Canvas
- [x] Real-time FFT audio spectrum visualizer integrated in IPA Studio
- [x] Status updated in `plans/README.md`
