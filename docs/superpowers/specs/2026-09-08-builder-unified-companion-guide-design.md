# Spec: Builder Unified Companion Sheet & Dynamic Guide System

## 1. Overview & Problem Statement

The current help architecture in the IxStates Nation Builder is fragmented across two competing paradigms:
1. **The Slide-over Companion Sheet** ([`BuilderGuideSheet.tsx`](file:///home/jxsig/projects/ixstats/src/app/builder/components/BuilderGuideSheet.tsx)): Triggered by the persistent header's `[ 📖 Guide ]` button, rendering a static 4-step list from `contextualHelp.ts`.
2. **Multiple Viewport-Blocking Centered Modals**:
   - [`AtomicWelcomeModal.tsx`](file:///home/jxsig/projects/ixstats/src/components/mycountry/domains/government/atomic/AtomicWelcomeModal.tsx) (Government component walkthrough)
   - [`EconomicWelcomeModal.tsx`](file:///home/jxsig/projects/ixstats/src/components/mycountry/domains/economy/atomic/EconomicWelcomeModal.tsx) (Economy component walkthrough)
   - [`BenchmarkHelpModal.tsx`](file:///home/jxsig/projects/ixstats/src/app/builder/components/enhanced/BenchmarkHelpModal.tsx) (Country benchmark template guide)
   - [`GovernmentHelpSystem.tsx`](file:///home/jxsig/projects/ixstats/src/app/builder/components/help/GovernmentHelpSystem.tsx) (Legacy government dialog)

### Key Problems:
- **Spatial Wayfinding Conflict**: Users encounter two competing buttons labeled "Guide" within 150px of each other (e.g. `[ 📖 Guide ]` in the studio header and `[ ? Component Guide ]` in the component subheader).
- **Workflow Interruption**: Centered modals impose an 80% opacity backdrop blur scrim, obscuring the cards, statistics, and budget meters the user is attempting to learn about. Users cannot reference instructions while interacting with their canvas.
- **Static vs. Reactive Disconnect**: The header guide is completely unaware of the user's active sub-tabs (e.g. `components` vs `structure` vs `spending`) and live state (e.g. chosen component counts, active synergies, and conflicting pairs).

---

## 2. Architectural Design & Philosophy

### Apple Design Principles Applied
- **Dim to Focus, Separate to Keep Flow**: In creative applications (Xcode, Keynote, Pages, Final Cut), Apple employs a right-flank Inspector panel rather than interruptive modal dialogs. Users must be able to inspect components, modify parameters, and read documentation in parallel.
- **Anchored Origins & Spatial Continuity**: A single slide-over sheet anchored to the right viewport boundary provides a consistent spatial destination for all help inquiries.
- **Wayfinding**: One single source of truth for guidance. Users never need to wonder which button opens the "right" guide.

### Emil Kowalski Design Engineering Principles Applied
- **Beauty is Leverage & Unseen Details Compound**: Unifying disparate dialogs into a cohesive, tactile companion elevates perceived product quality.
- **Deep-Linked Interactions**: Subheader trigger buttons deep-link into the companion sheet pre-switched to the corresponding tab without visual jumps.
- **High-Performance Physics**: Uses standard spring curves (`response: 0.4`, `damping: 1.0`) with GPU-accelerated compositing (`transform` and `opacity` only).

---

## 3. Detailed Component Architecture

### 3.1 State & Context Layer: `BuilderGuideContext`
Location: `src/app/builder/components/builder-guide-context.tsx`

```typescript
export type GuideTab = "milestones" | "rules" | "diagnostics";

export interface GuideOpenOptions {
  tab?: GuideTab;
  section?: BuilderSection;
}

export interface BuilderGuideContextValue {
  guideOpen: boolean;
  activeTab: GuideTab;
  activeSection: BuilderSection;
  openGuide: (options?: GuideOpenOptions) => void;
  closeGuide: () => void;
  setGuideOpen: (open: boolean) => void;
  setActiveTab: (tab: GuideTab) => void;
}
```

- **Mounted At**: `src/app/builder/components/BuilderRouter.tsx`, wrapping the builder page shell alongside `BuilderFilterProvider`.
- **Exported Hooks**: `useBuilderGuide()` for seamless access from any header, subheader, or form control.

### 3.2 Unified Companion Sheet: `BuilderGuideSheet.tsx`
Location: `src/app/builder/components/BuilderGuideSheet.tsx`

#### UI Layout & Elements:
1. **Glassmorphic Surface**: Radix `SheetContent` (`side="right"`, `sm:max-w-md lg:max-w-lg`) with `bg-card/95 backdrop-blur-2xl border-l border-white/10`.
2. **Contextual Header**: Displays the section title (e.g. "Government Companion", "Fiscal Engine Companion", "Country Template Companion") and an instant close button.
3. **Tactile Tab Bar**: Radix `TabsList` rendered as an iOS-style segmented control:
   - **Tab 1: Milestones (`"milestones"`)**: High-level workflow steps and section roadmap (sourced from `contextualHelp.ts`).
   - **Tab 2: Rules & Mechanics (`"rules"`)**: Consolidated domain rules (15-component cap, power balance, synergies, friction/conflicts, and upkeep formulas). Replaces `AtomicWelcomeModal` and `EconomicWelcomeModal`.
   - **Tab 3: Live Insights (`"diagnostics"`)**: Reactive statecraft telemetry displaying current selection counts, active synergy boosts, and detected conflicts.
4. **Statecraft Tips & Auto-Save Footer**: Real-time tips and persistent status indicator.

### 3.3 Trigger Deep-Linking & Subheader Integration

| Trigger Button | Originating Component | Target Call | Result |
| --- | --- | --- | --- |
| `[ 📖 Guide ]` | `BuilderStudioHeader.tsx` | `openGuide({ tab: "milestones" })` | Opens sheet with Milestones tab |
| `[ ? Component Guide ]` | `AtomicGovernmentComponents.tsx` | `openGuide({ tab: "rules", section: "government" })` | Opens sheet with Government Rules |
| `[ ? Component Guide ]` | `EconomyComponentPanel.tsx` | `openGuide({ tab: "rules", section: "economics" })` | Opens sheet with Economy Rules |
| `[ ? Help ]` | `EconomyBuilderHeader.tsx` | `openGuide({ tab: "milestones", section: "economics" })` | Opens sheet with Economy Milestones |
| `[ ? Template Guide ]` | `CountryGrid.tsx` | `openGuide({ tab: "rules", section: "foundation" })` | Opens sheet with Benchmark Guidelines |

### 3.4 First-Visit Auto-Open Mechanism
- Each section checks its respective `localStorage` record (e.g., `builder-guide-seen-government`, `builder-guide-seen-economics`).
- If unread, when the section mounts, the companion sheet smoothly slides open.
- When closed or dismissed, the key is recorded. Subsequent visits leave the sheet closed until manually triggered.

---

## 4. Retiring Redundant Legacy Code

The following redundant modals and dialogs will be decommissioned and removed from the Builder pipeline:
1. **`AtomicWelcomeModal.tsx`**: Removed from `GovernmentStep.tsx`.
2. **`EconomicWelcomeModal.tsx`**: Removed from `EconomyBuilderPage.tsx`.
3. **`BenchmarkHelpModal.tsx`**: Removed from `CountryGrid.tsx`.
4. **`GovernmentHelpSystem.tsx`**: Decommissioned (preserving `FieldHelpTooltip.tsx` for inline field explanations).
5. **`BuilderHelpWidget.tsx`**: Deleted (unused cut-out card).

---

## 5. Non-Functional Requirements & Guardrails

- **Line Ceiling Enforcement**: All files must strictly remain $\le 700$ lines.
- **Zero Raw Arbitrary Hexes**: All styling must utilize semantic Tailwind v4 tokens (`bg-card`, `text-foreground`, `border-border/40`, `text-amber-400`, `bg-amber-500/10`).
- **No Global Typecheck Execution**: Adhere strictly to the project rule prohibiting global `tsc --noEmit`. Use incremental validation.
- **Package Manager**: Bun 1.4+ only.
