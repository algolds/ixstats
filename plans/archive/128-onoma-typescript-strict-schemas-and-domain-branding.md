# Plan 128: Onoma TypeScript Strict Schemas and Domain Branding Overhaul

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7508ff4d..HEAD -- src/lib/onoma/types.ts src/server/api/routers/onoma/marketplace.ts src/server/api/routers/onoma/syntax.ts src/server/api/routers/onoma/core.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/126-onoma-centralize-generation-presets-and-ponytail-trim.md
- **Category**: tech-debt
- **Planned at**: commit `7508ff4d`, 2026-08-18
- **Status**: DONE

## Why this matters

Currently, complex database JSON fields in Language Packs, Syntax Profiles, and NameBank entries use `z.any()` and unchecked type casts (`as any`). This removes compile-time verification, risks corrupted JSON payloads entering Postgres, and prevents full auto-complete for frontend consumers. Introducing strict Zod schemas, branded domain types, and validated Stash note parsers guarantees end-to-end type safety across the linguistics pipeline.

## Current state

- `src/server/api/routers/onoma/marketplace.ts:85-90`:
  `phonologyRules: z.any().optional()`, `morphologyRules: z.any().optional()`, etc.
- `src/server/api/routers/onoma/syntax.ts:40-44`:
  `caseSystem: z.any().default({})`, `verbConjugation: z.any().default({})`.
- `src/server/api/routers/onoma/core.ts:83-110`:
  Unvalidated `JSON.parse(item.note)`.
- `src/app/labs/onoma/components/shared/NameResultCard.tsx:451`:
  `morphology={morphology as any}`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install   | `bun install` | exit 0 |
| Tests     | `bun run test -- src/lib/onoma` | all pass |
| Lint      | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `src/lib/onoma/types.ts`
- `src/server/api/routers/onoma/marketplace.ts`
- `src/server/api/routers/onoma/syntax.ts`
- `src/server/api/routers/onoma/core.ts`
- `src/app/labs/onoma/components/shared/NameResultCard.tsx`

**Out of scope**:
- Database migrations or table modifications.

## Git workflow

- Branch: `advisor/128-onoma-ts-schemas`
- Commit style: `refactor(onoma): <summary>`

## Steps

### Step 1: Define Strict Schemas & Branded Types in `types.ts`

In `src/lib/onoma/types.ts`:
Add branded types and domain schemas:

```typescript
import { z } from "zod";

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type IPAString = Brand<string, "IPAString">;
export type LanguagePackId = Brand<string, "LanguagePackId">;

export const toIPAString = (s: string): IPAString => s as IPAString;

// Strict Conlang Marketplace Schemas
export const PhonologyRulesSchema = z.object({
  consonants: z.array(z.string()).default([]),
  vowels: z.array(z.string()).default([]),
  syllables: z.array(z.string()).default(["CV", "CVC"]),
  maxConsonantCluster: z.number().int().min(1).max(6).default(3),
  stressRule: z.enum(["initial", "penultimate", "ultimate", "none"]).default("penultimate"),
});

export const MorphologyRulesSchema = z.object({
  genderSystem: z.enum(["masculine-feminine-neuter", "animate-inanimate", "common-neuter", "none"]).default("none"),
  declensionPatterns: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

export const StashNoteMetadataSchema = z.object({
  category: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  values: z.array(z.string()).default([]),
});

export type PhonologyRules = z.infer<typeof PhonologyRulesSchema>;
export type MorphologyRules = z.infer<typeof MorphologyRulesSchema>;
export type StashNoteMetadata = z.infer<typeof StashNoteMetadataSchema>;
```

**Verify**: `bun run test -- src/lib/onoma` → all pass

### Step 2: Replace `z.any()` in Marketplace & Syntax Routers

1. In `src/server/api/routers/onoma/marketplace.ts`:
   Replace `z.any()` inputs in `publish` with:
   - `phonologyRules: PhonologyRulesSchema.optional()`
   - `morphologyRules: MorphologyRulesSchema.optional()`
   - `dictionaries: z.array(z.object({ name: z.string(), category: z.string(), values: z.array(z.string()) })).optional()`
2. In `src/server/api/routers/onoma/syntax.ts`:
   Replace `z.any()` in `saveProfile` with:
   - `caseSystem: z.record(z.string(), z.string()).default({})`
   - `verbConjugation: z.record(z.string(), z.string()).default({})`
   - `articles: z.record(z.string(), z.string()).default({})`
   - `numberSystem: z.record(z.string(), z.string()).default({})`

**Verify**: `bun run lint` → exit 0

### Step 3: Validate Stash Item Note Serialization in `core.ts`

In `src/server/api/routers/onoma/core.ts`:
Replace unchecked `JSON.parse` with safe schema parsing:

```typescript
let category: string | null = null;
let role: string | null = null;
let gender: string | null = null;
let setName: string | null = null;
let values: string[] = [];

if (item.note) {
  try {
    const raw = JSON.parse(item.note);
    const parsed = StashNoteMetadataSchema.safeParse(raw);
    if (parsed.success) {
      category = parsed.data.category || null;
      role = parsed.data.role || null;
      gender = parsed.data.gender || null;
      setName = parsed.data.setName || null;
      values = parsed.data.values.flatMap((v) => v.split(/[\r\n,\s]+/)).map((v) => v.trim()).filter(Boolean);
    }
  } catch {
    if (item.contentType === "dictionary") {
      values = item.note.split(/[\r\n,\s]+/).map((v) => v.trim()).filter(Boolean);
    }
  }
}
```

**Verify**: `bun run test -- src/lib/onoma` → all pass

## Done criteria

- [ ] Zero `z.any()` in `onoma/marketplace.ts` and `onoma/syntax.ts`
- [ ] Safe `StashNoteMetadataSchema.safeParse` replaces raw `JSON.parse`
- [ ] `(morphology as any)` cast removed from `NameResultCard.tsx`
- [ ] All unit tests pass with 0 errors
- [ ] Status updated in `plans/README.md`

## STOP conditions

- If existing database entries contain JSON that fails strict validation, ensure defaults (`.default({})` or `.catch({})`) prevent query failure.
