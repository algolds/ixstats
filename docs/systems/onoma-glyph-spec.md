# ⟨ONOMA⟩ Glyph System Specification

**Last updated:** August 2026  
**Status:** Production Ready (Beta) — Onoma v4  
**Hierarchy:** Sub-system of Onoma (`ONOMA_VERSION = 4`).

---

## 01 — The Five Core Principles

1. **Notation over illustration** — Symbolic, algebraic, and structural diagrams rather than literal physical objects.
2. **Geometry over detail** — Built from essential points, strokes, nodes, arcs, and angle frames.
3. **Monochrome first** — Designed in pure high-contrast black/white (`currentColor`); semantic accent colors indicate state, not substance.
4. **Meaning through composition** — Small primitives combine into compound expressions (e.g. `⟨◌⟩`, `◌ → ◌`, `⟨CVC⟩`).
5. **Pixel grid alignment** — Crisp at 16px micro sizes with zero subpixel blurring.

---

## 02 — System Architecture: UI Actions vs. Linguistic Notations

| Domain | Library / Implementation | Responsibilities & Examples |
| :--- | :--- | :--- |
| **Mundane UI Actions** | **Iconoir (`iconoir-react`)** | Standard interface controls: `Search`, `Settings`, `NavArrowLeft`, `NavArrowRight`, `Cancel`, `Copy`, `Download`, `Volume`, `HelpCircle`, `Check`, `Plus`, `Trash`, `Sliders` |
| **Linguistic Notations** | **Custom Onoma Glyphs (`<OnomaGlyph />`)** | Conceptual linguistic machinery: `Phonology`, `Acoustics`, `Sound Shifts`, `Branching`, `Synthesis/Emergence`, `Lexicon`, `Etymology`, `Morphology`, `Writing Systems`, `Language Packs` |

---

## 03 — The Six Semantic Domains

1. **SOUND**: Phonology, Acoustics, Articulation, Formants, Voice
2. **STRUCTURE**: Phonotactics, Syllables, Templates, Syntax Trees
3. **TRANSFORMATION**: Sound Shifts, Rules, Evolution, Conversions
4. **MEMORY**: Etymology, Historical Derivation, Corpora, Stash
5. **COMPOSITION**: Morphology, Agglutination, Compounds, Lexicon
6. **EMERGENCE**: Markov Chains, Synthesis, Generation, Engine Mark

---

## 04 — React `<OnomaGlyph />` Component API

Located in `src/app/labs/onoma/components/glyphs/`:

```tsx
import { OnomaGlyph } from "~/app/labs/onoma/components/glyphs";

// 1. Canonical Glyph
<OnomaGlyph name="sound-acoustic" size="md" />

// 2. State Accent
<OnomaGlyph name="transform-shift" size="sm" state="active" accentColor="#ec4899" />

// 3. Composed Expression
<OnomaGlyph variant="composed" from="/k/" to="/tʃ/" size="lg" />

// 4. Bounded Entity Frame
<OnomaGlyph variant="framed" label="ROOT" size="md" />
```

---

## Related Documentation

- [Onoma Brand Guide](./onoma-brand-guide.md)
- [Onoma Voice & Kokoro TTS Guide](./onoma-voice-guide.md)
