# Plan 127: Onoma Performance Overhaul — Dynamic Route Code-Splitting and Lazy LM Calibration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/app/labs/onoma/components/OnomaRouter.tsx src/hooks/useOnomaGenerator.ts src/lib/onoma/perplexity.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/126-onoma-centralize-generation-presets-and-ponytail-trim.md
- **Category**: perf
- **Planned at**: commit `7508ff4d`, 2026-08-18
- **Status**: DONE

## Why this matters

The main `/labs/onoma` entry page statically imports `@xyflow/react`, `StudioSection`, `MarketplaceSection`, and all sub-modules simultaneously. This bloats the initial bundle by >120KB and inflates Total Blocking Time (TBT) even if the user only visits Places or Overview. Simultaneously, `useOnomaGenerator` eagerly trains an n-gram language model (`trainLM`) and recalculates cross-entropy on up to 3,000 strings on the main thread whenever any slider or option changes. Dynamic code splitting and deferred LM training keep the UI responsive at 60fps.

## Current state

- `src/app/labs/onoma/components/OnomaRouter.tsx:37-47`:
  Static imports of `StudioSection`, `MarketplaceSection`, `SettingsSection`, `StashSection`.
- `src/hooks/useOnomaGenerator.ts:217`:
  ```typescript
  lmRef.current = allSeeds.length > 0 ? trainLM(allSeeds, 3) : null;
  ```
  Synchronously trained on every React state change inside `useEffect`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/app/labs/onoma/components/OnomaRouter.tsx`
- `src/hooks/useOnomaGenerator.ts`
- `src/lib/onoma/perplexity.ts`
- `src/lib/onoma/perplexity.test.ts`

**Out of scope**:
- Modifications to database schema or tRPC API endpoints.

## Git workflow

- Branch: `advisor/127-onoma-perf-codesplit`
- Commit style: `perf(onoma): <summary>`

## Steps

### Step 1: Code-Split Heavy Onoma Sections in `OnomaRouter.tsx`

In `src/app/labs/onoma/components/OnomaRouter.tsx`:
Replace static imports of heavy sections with Next.js `dynamic`:

```typescript
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const SectionLoadingFallback = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-[#0091ff]" />
  </div>
);

const StudioSection = dynamic(() => import("./sections/StudioSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});
const MarketplaceSection = dynamic(() => import("./sections/MarketplaceSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});
const StashSection = dynamic(() => import("./sections/StashSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});
const SettingsSection = dynamic(() => import("./sections/SettingsSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});
```

**Verify**: `bun run lint` → exit 0

### Step 2: Lazy/Deferred Language Model Calibration

In `src/hooks/useOnomaGenerator.ts`:
1. Do not eagerly calculate `trainLM` inside the synchronous seeds effect.
2. Store `allSeeds` in a ref `activeSeedsRef`.
3. Lazily compute and cache `NgramLM` only upon the first invocation of `scoreNaturalness()` or `generate()`:

```typescript
const activeSeedsRef = useRef<string[]>([]);
const lmCacheRef = useRef<{ key: string; lm: NgramLM | null }>({ key: "", lm: null });

const getOrTrainLM = useCallback((): NgramLM | null => {
  const seeds = activeSeedsRef.current;
  if (!seeds || seeds.length === 0) return null;
  const cacheKey = `${culture}:${category}:${subType}:${seeds.length}`;
  if (lmCacheRef.current.key === cacheKey && lmCacheRef.current.lm) {
    return lmCacheRef.current.lm;
  }
  const trained = trainLM(seeds, 3);
  lmCacheRef.current = { key: cacheKey, lm: trained };
  return trained;
}, [culture, category, subType]);

const scoreNaturalness = useCallback(
  (name: string): number | null => {
    const lm = getOrTrainLM();
    return lm ? naturalnessScore(name, lm) : null;
  },
  [getOrTrainLM]
);
```

**Verify**: `bun run test -- src/lib/onoma/perplexity.test.ts` → all pass

## Test plan

- Test navigating between Overview, Places, and Studio tabs without hydration errors.
- Test dragging the Markov order slider in QuickGeneratorControls without frame drops.
- Test naturalness score badges in `NameResultCard` compute accurately on demand.

## Done criteria

- [ ] `StudioSection` and `@xyflow/react` are loaded on demand via `dynamic()`
- [ ] `trainLM` is lazily evaluated on demand rather than eagerly trained on every render
- [ ] All tests in `src/lib/onoma` pass with 0 errors
- [ ] Status updated in `plans/README.md`

## STOP conditions

- If dynamic import causes flickering on tab switch, ensure `loading` fallback retains bounding dimensions.
