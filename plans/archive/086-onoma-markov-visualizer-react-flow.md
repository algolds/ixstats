# Plan 086: Onoma Markov Visualizer using React Flow

Add an interactive, circular-layout Markov chain probability visualizer to the Studio section in Onoma Lab using `@xyflow/react`.

## User Review Required

> [!NOTE]
> - We will use the already-installed `@xyflow/react` (React Flow) library.
> - The graph displays a center node representing the current trained state/prefix, branching out to circular-positioned next-token nodes and a red/amber "[End]" termination node.
> - Directed edges between nodes represent transition paths. Edge thickness and visual style will scale based on transition probability, showing the exact percentage (e.g. `45.2%`).
> - Clicking any branch node appends it to the active prefix and centers the visualizer on that node, allowing users to interactive-generate names token-by-token.

---

## Proposed Changes

### Core Markov Engine

#### [MODIFY] [markov-chain.ts](file:///home/jxsig/projects/ixstats/src/lib/onoma/markov-chain.ts)
- Add a public method `getTransitions(prefix: string, order?: number)` to retrieve next-token transition statistics:
  - Tokenizes prefix into syllables/characters.
  - Matches the trailing key to the corresponding lookup maps/starts.
  - Calculates count and probability percentage for all possible subsequent neighbors (including `null` termination).
  - Returns a sorted list of `{ token: string | null; count: number; probability: number }`.

---

### React Flow Visualizer Component

#### [NEW] [MarkovVisualizer.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/MarkovVisualizer.tsx)
- Create the visualizer component wrapping `@xyflow/react`:
  - Receives `chain: MarkovChain`, `activePrefix: string`, and `onSelectToken: (token: string) => void`.
  - Maps transitions to nodes and edges.
  - Calculates circular positions for neighbor nodes:
    - Center node (active prefix) at `(250, 250)`.
    - Neighbor nodes spaced evenly at `(250 + R * cos(a), 250 + R * sin(a))` with $R = 150px$.
  - Styles nodes with Facet glass design system:
    - Center node: Solid Onoma Blue border.
    - Neighbor nodes: Muted gray/indigo outline, clickable button look.
    - Termination node: Red/amber styling.
  - Sets edge thickness and labels showing the exact probability.
  - Adds a "Reset Path" button to start back at an empty prefix.

---

### Studio Integration

#### [MODIFY] [StudioSection.tsx](file:///home/jxsig/projects/ixstats/src/app/labs/onoma/components/sections/StudioSection.tsx)
- Import `MarkovVisualizer` and `Volume2`.
- Maintain a local state `visualizerPrefix: string` inside `StudioSection`.
- Render the `MarkovVisualizer` in a dedicated card panel under the "Trained Engine" segment.
- Wire node clicks to append characters/syllables to `visualizerPrefix` and update the view dynamically.

---

## Verification Plan

### Automated Tests
- Add a new unit test in `markov-chain.test.ts` verifying that `getTransitions` correctly aggregates counts and calculates accurate probability shares for standard datasets.
  `bun run test -- src/lib/onoma/markov-chain.test.ts`

### Manual Verification
- Open Onoma Lab, navigate to **Studio**, and load or type custom seeds.
- Train the engine and inspect the interactive graph.
- Verify node positioning, click transitions, edge labels, and that clicking nodes correctly guides the name-building process.
