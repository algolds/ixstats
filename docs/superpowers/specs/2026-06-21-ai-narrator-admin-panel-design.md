# AI Narrator Admin Panel & Live Playground

Design specification for building a new administrative console panel to configure, test, preview, and moderate the AI Narrator system.

## 1. Goal Description
To provide administrative control over the system-wide AI Narrator. The admin dashboard needs a dedicated console page offering:
1. **Config Management:** Global enable switch, provider selection (Nvidia, OpenRouter, OpenAI), parameters (temperature, model name, custom endpoint), and API credentials.
2. **System Prompt Customization:** Ability to customize and save the global CK3/Paradox-style system prompt.
3. **Live Playground:** Test generation on the fly using either real database items (Issues, Policies, Decisions) or sandbox input.
4. **Cache Lab:** Inspect caches and clear cached narration strings.

## 2. Proposed Changes

### 2.1 Backend Router Procedures
Modify [index.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/narrator/index.ts) to export:
- `getNarratorSettings`: `adminProcedure.query` — Fetches key configs from `SystemConfig`.
- `saveNarratorSettings`: `adminProcedure.mutation` — Saves provider, api key, endpoint, model, temp, and global system prompt overrides.
- `testFlavorize`: `adminProcedure.mutation` — Takes input details + custom system prompt, fetches country context, calls the LLM immediately (bypassing cache), and returns results for visual preview.
- `getCacheStats`: `adminProcedure.query` — Returns custom cache statistics.
- `clearCache`: `adminProcedure.mutation` — Wipes custom cached narrator strings.

### 2.2 Navigation Changes
Modify [AdminSidebar.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/_components/AdminSidebar.tsx) and [AdminSidebarNavWidget.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/_components/AdminSidebarNavWidget.tsx) to:
- Add a new "AI Narrator" link under "Labs".
- Section ID: `narrator`.

Modify [AdminRouter.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/_components/AdminRouter.tsx) to:
- Dynamically import `NarratorAdminPanel` component.
- Add `case "narrator": return <NarratorAdminPanel />;` block.

### 2.3 UI Panel Layout
Create [NarratorAdminPanel.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/_components/NarratorAdminPanel.tsx):
- A tabbed structure:
  - **Tab 1: API Configuration & Prompt Settings**
    - Fields: Enable switch, LLM Provider dropdown, API Key input, Endpoint URL input, Model Name input, Temperature slider.
    - Global System Prompt Editor: Textarea to edit the system prompt (defaulting to the Paradox Interactive tone system prompt).
    - Actions: Save Changes button.
  - **Tab 2: Live Testing Playground**
    - Event Source Selection: Toggle between "Real Data" and "Sandbox Mode".
      - *Real Data:* Choose Country dropdown → Choose Event Type (Issue/Policy/Decision) → Select database item (loads item list via API).
      - *Sandbox:* Custom Title, Description, and JSON-encoded Country Metrics.
    - Prompt Override: An optional textarea to test adjustments to the system prompt in real-time.
    - Trigger button: Submits to `testFlavorize`.
    - Preview Card: Renders the outcome inside the real `<ParadoxFlavorCard>` mockup view.
  - **Tab 3: Cache Management**
    - Displays total cached items, hit ratios, and average latency.
    - Action: "Clear Narrator Cache" button.

## 3. Verification Plan

### 3.1 Automated Tests
- None. (Note: global manual typechecks and builds are disabled).

### 3.2 Manual Verification
- Open the Admin Console under the "/admin" route.
- Confirm the "AI Narrator" link is visible under Labs.
- Go to the panel, save a test model name, and verify it updates.
- Use the playground in sandbox mode to write a mock issue, trigger flavorization, and inspect the resulting Paradox card layout.
- Edit the system prompt in the playground override, run a test, and check if the tone adapts.
- Test the cache clearing button and ensure it executes successfully.
