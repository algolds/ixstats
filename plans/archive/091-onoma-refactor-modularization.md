# 091 — Onoma Codebase Modularization & Refactoring

Refactor and modularize the Onoma conlang project's React components. Extract sub-components, helper states, and display utilities from oversized files (19KB to 37KB) to improve readability, code reuse, and testability.

## Decisions & Design

| Goal | Strategy |
|------|----------|
| **Split target 1: `NameResultCard.tsx`** | Extract the inline **Pronunciation Editor** and **Linguistic Profile Details** (IPA scripts & declension tables) to keep the core card layout focused. |
| **Split target 2: `StashSection.tsx`** | Extract the **ImportStashPanel** (drag & drop conlang dictionary/stash imports) and **SavedDictionaryCard** to resolve grid complexity. |
| **Split target 3: `StudioLexicon.tsx`** | Extract the **LexiconAnalysis** (CV phonotactic pattern, counts grid) and **LexiconDefinitionForm** into standalone files. |
| **Split target 4: `GeneratorPanel.tsx`** | Extract the **AdvancedConlangSettings** options grid and switches drawer. |
| **Architectural boundary** | All extracted sub-components stay close to their domains under `src/app/labs/onoma/components/shared/` or `src/app/labs/onoma/components/sections/studio/`. |

---

## Steps

### 1. Modularize `NameResultCard.tsx` (~800 lines)

Extract sub-components to reduce file size:

#### [NEW] [PronunciationEditor.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/PronunciationEditor.tsx)
- Expose `PronunciationEditor` component.
- Accepts `name: string`, `ipaDraft: string`, `setIpaDraft: (v: string) => void`, `voiceDraft: string`, `setVoiceDraft: (v: string) => void`, `onSave: () => void`, `onCancel: () => void`, `onPreview: () => void`.
- Includes IPA suggestion button triggering backend `suggestPhonemes` mutation.

#### [NEW] [LinguisticProfile.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/LinguisticProfile.tsx)
- Expose `LinguisticProfile` component.
- Accepts `name: string`, `gender: string`, `savedAt?: Date | string | null`, `originLabel?: string | null`, `declensionTable?: any`.
- Handles Cyrillic/Greek/Arabic transcription script grids and the Noun Declension (cases) grid.

#### [MODIFY] [NameResultCard.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/NameResultCard.tsx)
- Replace inline blocks with `<PronunciationEditor />` and `<LinguisticProfile />`.

---

### 2. Modularize `StashSection.tsx` (~760 lines)

Extract conlang file importing and dictionary card layouts:

#### [NEW] [ImportStashPanel.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/stash/ImportStashPanel.tsx)
- Expose conlang importer panel with drag & drop file handlers.
- Accepts `onImportSuccess: (createdCount: number) => void`.

#### [NEW] [SavedDictionaryCard.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/stash/SavedDictionaryCard.tsx)
- Expose `SavedDictionaryCard` component to clean up the stash main layout.
- Renders the metadata info row (seeds count, public status, name set tags) and utility actions (words view, edit modal, delete).

#### [MODIFY] [StashSection.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/StashSection.tsx)
- Replace inline dictionary cards list and upload elements with `<SavedDictionaryCard />` and `<ImportStashPanel />`.

---

### 3. Modularize `StudioLexicon.tsx` (~710 lines)

Extract details and definition inputs:

#### [NEW] [LexiconAnalysis.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/LexiconAnalysis.tsx)
- Expose the **Phonotactic Pattern**, **Composition**, and **Stash Folder** grid.
- Takes the active conlang term, folder name/color, and name set source metadata.

#### [NEW] [LexiconDefinitionForm.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/LexiconDefinitionForm.tsx)
- Expose conlang meaning definition form panel.
- Accepts POS, Root, Meaning, Notes, and trigger saves.

#### [MODIFY] [StudioLexicon.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx)
- Replace inline analysis/form blocks.

---

### 4. Modularize `GeneratorPanel.tsx` (~600 lines)

#### [NEW] [AdvancedConlangSettings.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/AdvancedConlangSettings.tsx)
- Expose advanced phonotactics controls drawer (syllables range inputs, CV sequence match text, clusters switches).

#### [MODIFY] [GeneratorPanel.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/shared/GeneratorPanel.tsx)
- Replace the inline conlang controls panel with `<AdvancedConlangSettings />`.

---

## Verification Plan

### Automated Tests
```bash
bun run lint
bun run typecheck:ui
bun run test -- src/lib/onoma/
```

### Manual Verification
- Deploy conlang generator lab.
- Generate candidates using the advanced options drawer to ensure filters apply.
- Click conlang stash name cards to trigger morph expand.
- Open conlang lexicon tab to verify orthographic details and definition updates.
