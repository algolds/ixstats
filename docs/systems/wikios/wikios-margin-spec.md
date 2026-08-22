# WikiOS Margin — Unified Split-Canvas Inspector & Article Markup Specification

**Document Version:** 2.1.0  
**Date:** August 21, 2026  
**Status:** Implemented & Canonical Architecture Specification  
**Target Subsystems:** WikiOS Margin (`src/components/wiki-os/margin/`), Discussions Router (`src/server/api/routers/wikios/discussions.ts`), Reader (`src/components/wiki-os/reader/ArticleRenderer.tsx`), Schema (`prisma/schema/wiki.prisma`)  
**Applied Design Paradigms:** Apple Design (`/apple-design`), Emil Kowalski Design Engineering (`/emil-design-eng`), TypeScript 7.0 (`/typescript-expert`), Anti-Overengineering (`/ponytail-audit`)

---

## 1. System Vision & Core Interface Philosophy

Traditional wiki "Talk Pages" fail because they break spatial and temporal continuity: asking or answering a question about a sentence forces a full page navigation away from the text to a disconnected wall of unstyled wikitext.

WikiOS replaces `/wiki/[slug]/talk` with **WikiOS Margin** — a responsive, hardware-accelerated split-canvas inspector that docks to the reading view. It converges three previously fragmented systems into one fluid panel:

```
┌────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
│  IxWiki: Treaty of Oakhaven                            │  WikiOS Margin                [⤢] [✕]    │
│                                                        ├──────────────────────────────────────────┤
│  The Treaty of Oakhaven concluded the six-year war...  │  [ 💬 Threads ] [ ✏️ Markup ] [ 📑 Stash ]│
│                                                        ├──────────────────────────────────────────┤
│  == Territorial Boundaries ==           ┌───┐          │  💬 Section: Territorial Boundaries      │
│  The eastern frontier was re-established│ 💬│ ◄─────── │  Thread #12 · Open · 3 comments          │
│  along the thalweg of the Morava River. └───┘          │  "Does this border match the 1902 survey │
│                                         (Gutter Pin)   │   referenced in the national atlas?"     │
│  == Financial Clauses ==                               │  ┌─────────────────────────────────────┐ │
│  An indemnity of 40M sovereigns was...                 │  │ ↩ Reply with wikitext or note...    │ │
│                                                        │  └─────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┴──────────────────────────────────────────┘
```

1. **💬 Threads**: Structured, threaded conversations anchored to the entire page or specific heading sections (replaces legacy talk pages).
2. **✏️ Markup & Annotations**: Multi-color text highlights, paragraph notes, and suggested draft edits.
3. **📑 Stash & Citations**: Personal bookmarks, clipped excerpts, attached factbook metrics, and collection links.

---

## 2. Interface & Interaction Concepts

### Concept A: The Unified Slide-Over Inspector (`WikiMarginDrawer.tsx`)
The primary workspace docks on the right side of the screen without occluding the article text on desktop ($\ge 1280\text{px}$) and behaves as an interruptible gesture bottom-sheet on tablet/mobile.

```
┌────────────────────────────────────────────────────────┐
│  [ 💬 Threads (4) ] [ ✏️ Markup (2) ] [ 📑 Stash ]      │ ◄── Segmented Pill Slider (Spring)
├────────────────────────────────────────────────────────┤
│  ⚡ FILTERS: [ All ] [ Open ] [ Resolved ]              │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💬 Morava River Thalweg Boundary                 │  │ ◄── Thread Card
│  │ Anchored to "Territorial Boundaries" · 2h ago    │  │     (scale: 0.97 on press)
│  │ ──────────────────────────────────────────────── │  │
│  │ Alex_K: "Does this account for the 1902 survey?" │  │
│  │ ↳ 2 replies · [ Hold to Resolve ]                │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🟡 Highlighted: "indemnity of 40M sovereigns"    │  │ ◄── Markup Note Card
│  │ Marcus: "Check currency conversion table"        │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  [ + New Thread ] or [ Add Section Note ]              │
└────────────────────────────────────────────────────────┘
```

#### Key Functional Details
* **Zero-Navigation Access**: Triggered via the reader toolbar, pressing key `T` or `I`, or clicking any margin gutter pin.
* **Context Synchronization**: As the reader scrolls through the article, the inspector highlights threads anchored to the currently visible section in the viewport.
* **Thread Resolution Lifecycle**: Threads have clear binary states (`OPEN` vs `RESOLVED`). Resolving a thread smoothly collapses it with an animated height transition.

---

### Concept B: Margin Gutter Pins & Text-Anchor Overlay (`MarginGutterPins.tsx`)
Instead of hunting through a separate page, discussion threads and annotations surface directly in the reading margins.

```
Article Body Text                                         Margin Gutter (Right)
───────────────────────────────────────────────────────── ────────────────────
The eastern frontier was fixed along the Morava River.    [ 💬 2 ] ◄── Glowing Bubble
All military garrisons within 20km were demobilized.
                                                          [ 🟡 Note ]
Under Article VII, maritime transit rights were guaranteed.
```

#### Key Functional Details
* **Spatial Alignment**: Gutter pins are calculated from the bounding box of their target DOM elements (`h2`, `p`, `table`, `.infobox`), positioned with sub-pixel precision.
* **Interactive Hover Bridge**:
  * Hovering a gutter pin applies a subtle high-contrast outline to the anchored text in the article (`.wikios-anchor-highlighted`).
  * Hovering highlighted text in the article causes the matching gutter pin to scale up (`scale(1.1)`) with an active spring.
* **Colliding Pin Stacking**: When multiple comments exist on adjacent lines, pins stack into a cohesive cluster counter badge (`[ 💬 3 ]`) that fans out on hover.

---

### Concept C: Origin-Aware Floating Selection Capsule (`SelectionCapsule.tsx`)
When a user selects text anywhere in the article, a compact, origin-aware action capsule emerges directly above the selection.

```
          ┌───────────────────────────────────────────────────┐
          │  [🟡 🟢 🔵 🔴]  │  💬 Discuss  │  📑 Stash  │  📋 Copy │ ◄── Origin-Aware Capsule
          └─────────────────────────┬─────────────────────────┘
                                    ▼ (Points to selection)
"The eastern frontier was re-established along the thalweg..."
```

#### Key Functional Details
* **Instant Actions**:
  * **Highlight**: Drops a highlight in yellow, emerald, blue, or rose palette (`HIGHLIGHT_PALETTE`).
  * **Discuss**: Opens Margin drawer focused on creating a new discussion anchored to the selected phrase.
  * **Stash**: Saves the highlighted quote to the user's active Lore Stash collection with 1 click.
  * **Copy**: Copies the raw text quote to clipboard with instant confirmation toast.
* **Origin Calculation**: `transform-origin` dynamically aligns to the center of the text selection bounding rectangle, scaling in naturally from `0.95` scale.

---

## 3. Design Engineering & UI Polish Review (`/emil-design-eng` + `/apple-design`)

### Mandatory Design Engineering Review Table

| Before (Legacy Pattern) | After (Design-Engineered Pattern) | Why & Technical Rationale |
| :--- | :--- | :--- |
| Full-page route push to `/wiki/[slug]/talk` | Split-canvas slide-over inspector (`transform: translateX()`) | Preserves reading context; zero navigation latency |
| `transition: all 300ms ease` | `transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1)` | `all` recalculates expensive layout; custom curve provides punchy, instant response |
| `scale(0)` entry animation on selection popup | `transform: scale(0.95); opacity: 0` $\to$ `scale(1); opacity: 1` | Nothing in physical reality scales from zero; $0.95$ feels natural and un-jarring |
| `transform-origin: center` on selection capsule | `transform-origin: center bottom` | Capsule emerges directly out of the user's highlighted text selection |
| Static button click with no feedback | `transform: scale(0.97)` on `:active` with `160ms ease-out` | Buttons feel physically responsive and confirm user interaction instantly |
| Abrupt thread expansion causing layout jumps | Spring accordion transitions with `AnimatePresence` | Smooth layout morphing prevents frame drops during DOM expansion |
| Drag-to-dismiss requiring 50% drag threshold | Momentum velocity check (`velocity > 0.11px/ms` or `deltaX > 100px`) | Quick flick dismisses the inspector effortlessly regardless of distance dragged |
| Immediate click-to-resolve causing accidental clicks | Hold-to-resolve (1.0s linear fill with `clip-path: inset()`) | Deliberate press prevents destructive accidents; snapping release provides tactile reward |
| Opaque gray background on talk elements | `backdrop-filter: blur(24px) saturate(190%)` over `rgba(6, 8, 12, 0.85)` | Translucent Facet glass hierarchy allows article colors to subtly refract underneath |

---

## 4. Interaction Physics & Motion Code Specifications

### 4.1 Custom Easing Curves & Timing Tokens
```css
:root {
  /* Fast UI interaction curve (Emil Kowalski punchy ease-out) */
  --wikios-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  
  /* Smooth drawer/sheet deceleration curve (iOS / Vaul style) */
  --wikios-ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
  
  /* Standard transition speeds */
  --wikios-duration-press: 160ms;
  --wikios-duration-popover: 180ms;
  --wikios-duration-sheet: 320ms;
}
```

### 4.2 Origin-Aware Selection Capsule Component
```tsx
// Floating capsule positioning hook using Selection Centroid
export function SelectionCapsule({ contentRef, onAddHighlight, onOpenThreadDraft, onStashQuote, isAuthenticated }) {
  // Calculates selection bounding box and centers popup at (rect.left + rect.width / 2)
  // Renders with transformOrigin: "center bottom", scale(0.95) -> 1.0
}
```

### 4.3 Hold-to-Resolve Button Implementation
```tsx
// Hold-to-Resolve pattern with progressive clip-path reveal
export function HoldToResolveButton({ isResolved, onResolveToggle, isPending }) {
  const [holding, setHolding] = useState(false);
  // 1.0s timer triggers onResolveToggle and soundEffects.success()
  // Progress overlay animates clipPath from inset(0 100% 0 0) to inset(0 0% 0 0)
}
```

---

## 5. TypeScript 7.0 & Database Architecture

### 5.1 Prisma Schema (`prisma/schema/wiki.prisma`)

```prisma
enum DiscussionStatus {
  OPEN
  RESOLVED
  ARCHIVED
}

/// A structured discussion thread on a wiki article (WikiOS Margin)
model WikiDiscussionThread {
  id            String            @id @default(cuid())
  articleTitle  String            // Normalized title (e.g. "Treaty_of_Oakhaven")
  status        DiscussionStatus  @default(OPEN)
  title         String            @db.VarChar(300)
  sectionAnchor String?           // Heading anchor ID (e.g. "Territorial_Boundaries")
  selectedText  String?           // Exact text quote if anchored to highlighted phrase
  anchorOffset  Int?              // Character offset in block
  resolvedAt    DateTime?
  resolvedBy    String?
  createdBy     String            // Author user ID
  countryId     String?           // Optional country affiliation
  teamId        String?           // Optional linked ThinktankGroup ID
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  comments      WikiDiscussionComment[]

  @@index([articleTitle, status])
  @@index([articleTitle, sectionAnchor])
  @@index([teamId])
  @@index([createdBy])
  @@map("wiki_discussion_threads")
}

/// A single comment or reply within a wiki discussion thread
model WikiDiscussionComment {
  id            String               @id @default(cuid())
  threadId      String
  userId        String
  countryId     String?
  content       String               @db.Text
  suggestedEdit String?              // Optional proposed wikitext replacement
  reactions     Json?                // Reaction counts { "👍": 3, "❤️": 1 }
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  thread        WikiDiscussionThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
  @@index([userId])
  @@map("wiki_discussion_comments")
}
```

### 5.2 Unified tRPC Router (`src/server/api/routers/wikios/discussions.ts`)

```typescript
export const wikiosDiscussionsRouter = createTRPCRouter({
  getArticleMarginData: publicProcedure.input(...).query(...),
  createThread: protectedProcedure.input(...).mutation(...),
  postComment: protectedProcedure.input(...).mutation(...),
  resolveThread: protectedProcedure.input(...).mutation(...),
  toggleCommentReaction: protectedProcedure.input(...).mutation(...),
  deleteThread: protectedProcedure.input(...).mutation(...),
  deleteComment: protectedProcedure.input(...).mutation(...),
});
```

---

## 6. Implementation Summary

1. **Drawer & Gutter Pins**: Implemented in `src/components/wiki-os/margin/WikiMarginDrawer.tsx` and `MarginGutterPins.tsx`.
2. **Selection Capsule**: Implemented in `src/components/wiki-os/margin/SelectionCapsule.tsx`.
3. **Pillar Tabs**: Implemented in `src/components/wiki-os/margin/tabs/MarginThreadsTab.tsx`, `MarginMarkupTab.tsx`, and `MarginStashTab.tsx`.
4. **Backend Router**: Implemented in `src/server/api/routers/wikios/discussions.ts` and registered in `src/server/api/routers/wikios/index.ts`.
5. **Reader Integration**: Mounted in `src/components/wiki-os/reader/ArticleRenderer.tsx` with hotkeys `T` / `I`.
6. **Route Forwarding**: Legacy `/wiki/[slug]/talk` routes cleanly redirect to `/wiki/[slug]?margin=threads`.
