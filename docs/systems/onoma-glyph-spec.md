# ⟨ONOMA⟩ Glyph System Specification v0.1

## Visual Direction: Apple SF Symbols × IPA × Linguistic Notation × Scientific Diagrams × Editorial Typography

> **Design Premise:**  
> *Onoma does not illustrate language. It notates it.*  
> The glyphs feel like something that could have been discovered in a linguist’s notebook, an acoustic instrument, or a precision typesetting system—not like pictograms pasted onto a SaaS dashboard.

---

## 01 — The Five Core Principles

1. **Notation over illustration** — Symbolic, algebraic, and structural diagrams rather than literal physical objects.
2. **Geometry over detail** — Built from essential points, strokes, nodes, arcs, and angle frames.
3. **Monochrome first** — Designed in pure high-contrast black/white (`currentColor`); semantic accent colors indicate state, not substance.
4. **Meaning through composition** — Small primitives combine into compound expressions (e.g. `⟨◌⟩`, `◌ → ◌`, `⟨CVC⟩`).
5. **Every glyph must work at 16px** — Crisp pixel grid alignment at micro sizes with zero subpixel blurring.

---

## 02 — System Architecture: UI Actions vs. Linguistic Notations

To maintain absolute purity and clarity, Onoma strictly splits iconography into two domains:

| Domain | Library / Implementation | Responsibilities & Examples |
| :--- | :--- | :--- |
| **Mundane UI Actions** | **Iconoir (`iconoir-react`)** | Standard interface controls: `Search`, `Settings`, `NavArrowLeft`, `NavArrowRight`, `Cancel` / `Xmark`, `Copy`, `Download`, `Volume`, `HelpCircle`, `Check`, `Plus`, `Trash`, `Sliders` |
| **Linguistic Notations** | **Custom Onoma Glyphs (`<OnomaGlyph />`)** | Conceptual linguistic machinery: `Phonology`, `Acoustics`, `Sound Shifts`, `Branching`, `Synthesis/Emergence`, `Lexicon`, `Etymology`, `Morphology`, `Syntax`, `Writing Systems`, `Language Packs` |

---

## 03 — The Fundamental Visual Grammar

The entire Onoma glyph alphabet is constructed from a small, closed vocabulary of primitives and operators:

### Primitives
```text
  POINT         LINE          ARC          NODE         FRAME
    •            ───           ◡            ●           ⟨   ⟩
(coordinate)  (sequence)  (quadrilateral) (state)      (bounded object)
```

### Operators
```text
  TRANSFORM       JOIN        SPLIT / FORK     ABSENCE / NULL
      →             +              ⑂                 ∅
(sound shift) (composition)   (divergence)      (deletion/zero)
```

### Linguistic Structural Notations
```text
  PHONEMIC      PHONETIC        MORPHOLOGICAL     STRUCTURAL
    /   /         [   ]             {   }            C   V
   /ə/             [ə]             {ROOT}             CVC
```

---

## 04 — The Six Semantic Domains

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ⟨ONOMA⟩ GLYPH TAXONOMY                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. SOUND (Phonology, Acoustics, Articulation, Formants, Voice)        │
│ 2. STRUCTURE (Phonotactics, Syllables, Templates, Syntax Trees)        │
│ 3. TRANSFORMATION (Sound Shifts, Rules, Evolution, Conversions)        │
│ 4. MEMORY (Etymology, Historical Derivation, Corpora, Stash)           │
│ 5. COMPOSITION (Morphology, Agglutination, Compounds, Lexicon)         │
│ 6. EMERGENCE (Markov Chains, Synthesis, Generation, Engine Mark)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 05 — Canonical Glyph Catalog (v0.1)

| Glyph ID | Name | Domain | Geometric Construction | Semantics / Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| `sound-phoneme` | **Phoneme Unit** | `SOUND` | `◌` (Dashed/Open Circle) | Abstract phonological unit, phoneme slot |
| `sound-articulation` | **Articulation Point** | `SOUND` | `◉` (Target Node / Concentric) | Voice source, focal point of articulation |
| `sound-acoustic` | **Acoustic Wave** | `SOUND` | `∿` (Sine / Harmonic Curve) | Formant frequencies, pitch, spectrograms |
| `sound-vowel-quad` | **Vowel Quad** | `SOUND` | `⏢` (Trapezoid quadrilateral) | IPA vowel chart (F1 vs F2 vowel space) |
| `struct-phonotactics` | **Phonotactics** | `STRUCTURE` | `CVC` (Structural glyph) | Syllable template constraint (CVC, CCV) |
| `struct-syntax` | **Syntax Node** | `STRUCTURE` | `⌘` / `NP→VP` (Structural tree) | Phrase structure, grammar parse tree |
| `struct-syllable` | **Syllable Boundary** | `STRUCTURE` | `σ` / `.` (Sigma node) | Syllable division, meter, onset-rhyme |
| `transform-shift` | **Sound Shift** | `TRANSFORMATION` | `◌ → ◌` (Dual node arrow) | Diachronic sound change, mutation rule |
| `transform-arrow` | **Transform** | `TRANSFORMATION` | `→` (Geometric arrow) | Rule application ($X \to Y / V\_V$) |
| `transform-correspond` | **Correspondence** | `TRANSFORMATION` | `↔` (Bidirectional vector) | Cognate mapping, dialect correspondence |
| `transform-deletion` | **Null / Deletion** | `TRANSFORMATION` | `∅` (Slashed zero) | Elision, apocope, phoneme drop |
| `memory-etymology` | **Etymological Root** | `MEMORY` | `A ← B` (Origin chain) | Historical origin, proto-form derivation |
| `memory-dataset` | **Corpus / Sequence** | `MEMORY` | `A₁A₂A₃` (Subscript sequence) | Training corpus, seed list, historical texts |
| `memory-stash` | **Repository Vault** | `MEMORY` | `⟨•⟩` (Framed point) | Saved names, locked lexicon repository |
| `compose-morphology` | **Morphology** | `COMPOSITION` | `+` / `A+B` (Composition node) | Prefix/suffix binding, agglutination |
| `compose-lexicon` | **Lexicon Dictionary**| `COMPOSITION` | `A·B·C` (Middle-dot sequence) | Word registry, lemma definitions |
| `compose-loanword` | **Loanword Adoption** | `COMPOSITION` | `L₁ ↝ L₂` (Wavy arrow) | Inter-language borrowing, calques |
| `emerge-branch` | **Branching / Fork** | `EMERGENCE` | `⑂` (Trifurcated vector) | Markov probability paths, dialect split |
| `emerge-synthesis` | **Synthesis / Emergence** | `EMERGENCE` | `✦` (Geometric 4-point node) | Name emergence, seed compilation |
| `emerge-engine` | **The Onoma Mark** | `EMERGENCE` | `◌─●─◌` (Central engine core) | Engine status, processing indicator |
| `system-pack` | **Language Pack** | `COMPOSITION` | `⟨📖⟩` (Framed lexicon book) | Community grammar & sound rules pack |
| `system-compare` | **Comparator** | `STRUCTURE` | `Δ` / `⚖` (Delta divergence) | Levenshtein distance, phonetic comparison |
| `system-writing` | **Orthography** | `STRUCTURE` | `[A]` (Brackets / Glyphic script) | Writing system, grapheme-to-phoneme (G2P) |
| `system-frame` | **Bounded Object** | `STRUCTURE` | `⟨ ⟩` (Guillemet frame) | Bounded linguistic token, name entity |

---

## 06 — Vector Grid, Stroke, and Optical Scale Rules

### Grid System
- **Base Grid:** `24px × 24px` with a 2px interior safety margin (active drawing box: `20px × 20px`).
- **Stroke Width:** Exactly `1.75px` (rendered on half-pixel coordinates for retina sharpness).
- **Line Caps & Joins:** `strokeLinecap="round"`, `strokeLinejoin="round"`.
- **Corner Radii:** Minimal `2px` on geometric corners.

### Three Optical Scales

```text
┌──────────────┬───────────────┬────────────────────────────────────────────────────────┐
│ Scale        │ Canvas Size   │ Stroke & Detail Rule                                   │
├──────────────┼───────────────┼────────────────────────────────────────────────────────┤
│ Micro        │ 16 × 16 px    │ 1.5px stroke. Pure geometric notation (single letter,  │
│              │               │ single arrow, single node). Zero secondary decoration. │
│ Standard     │ 24 × 24 px    │ 1.75px stroke. Full relational glyphs (A → B, ⑂, ∿).   │
│ Display      │ 48 – 96 px    │ 2.0px stroke. Composed linguistic diagrams with nodes, │
│              │               │ harmonic waves, and dynamic text specimens.            │
└──────────────┴───────────────┴────────────────────────────────────────────────────────┘
```

---

## 07 — Color & State Behavior

- **Default (Idle):** `text-foreground/75` (adapts cleanly to light/dark themes).
- **Hover:** `text-foreground` + subtle scale (`scale-[1.04]`).
- **Active / Selected:** Inherits the pillar/section theme color (e.g. `#0091ff` for Create, `#ec4899` for Studio, `#8b5cf6` for Explore) with an ambient glow (`box-shadow: 0 0 16px rgba(...)`).
- **Processing / Synthesis:** Pulsing opacity or animated node transition (`◌ → ● → ◌`).
- **Disabled:** `text-muted-foreground/30`.

---

## 08 — React `<OnomaGlyph />` Component API

```tsx
import { OnomaGlyph } from "~/app/labs/onoma/components/glyphs";

// 1. Canonical Glyph
<OnomaGlyph name="sound-acoustic" size="md" />

// 2. State Accent
<OnomaGlyph name="transform-shift" size="sm" state="active" accentColor="#ec4899" />

// 3. Composable Transformation Expression
<OnomaGlyph
  variant="composed"
  from="/k/"
  to="/tʃ/"
  size="lg"
/>

// 4. Bounded Entity Frame
<OnomaGlyph variant="framed" label="ROOT" size="md" />
```

---

## 09 — The Onoma Engine Mark (`emerge-engine`)

The signature mark of Onoma is not an illustrative logo, but a functional schematic of language processing:

```text
       ◌ (Input Phonemes)
      ╱
     ●  (Transformation Core / Markov Engine)
      ╲
       ◌ (Generated Name / Surface Form)
```

When animated during generation, the nodes shift state sequentially: `◌ ─→ ● ─→ ◌`.
