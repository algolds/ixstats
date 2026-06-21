# Paradox-style AI Narrator Flavorization & Toast Optimization

Design specification for adding CK3/Paradox-style dynamic narrative wrappers around geopolitical events (issues, policies, decisions) and optimizing the pending issues toast to only trigger once per session.

## 1. Goal Description

### 1.1 Reload Toast Optimization
Currently, the `useNationalIssuesToast` hook triggers a Dynamic Island toast notification on every page load/reload if the user has pending issues. We want to show this notification at most once per session (i.e. browser tab life cycle) to avoid annoying the user on page reloads, while still allowing updates if the counts of issues actually change during the active session.

### 1.2 Paradox-style Narrative Flavorization
We want to evolve the existing `myleague` AI narrator capabilities into a generalized `narrator` system. The narrator will convert geopolitical simulation events (issues, policies, decisions) into immersive but concise event cards.
The system prompt is:
> "You are a Paradox Interactive-style narrative designer.
> You convert geopolitical simulation events into immersive but concise event cards.
> Do not add new facts. Do not invent unrelated lore.
> Keep tone: diplomatic, slightly dramatic, grounded."

To enrich the immersion, we will pass the complete country metrics snapshot (GDP, stability, approval, government type, etc.) to the narrator. The prompt will instruct the LLM to adapt the mood, tone, and descriptions based on these metrics (e.g. tense/unstable descriptions if stability is low, or prosperous details if GDP growth is high).

## 2. Proposed Changes

### 2.1 Reload Toast Optimization
Modify [useNationalIssuesToast.ts](file:///ixwiki/public/projects/ixstats/src/hooks/useNationalIssuesToast.ts) to:
- Initialize the tracking `lastCountRef.current` with values retrieved from `sessionStorage` on mount.
- Write new counts to `sessionStorage` (under key `national_issues_last_counts`) whenever a toast is successfully enqueued.
- If the current pending/urgent counts match the values stored in `sessionStorage`, skip enqueuing the toast.
- If counts are 0, clean the `sessionStorage` key.
- Safe-guard all `sessionStorage` reads/writes with try-catch blocks to prevent SSR and private browsing crashes.

### 2.2 Shared AI Narrator client
Create [client.ts](file:///ixwiki/public/projects/ixstats/src/lib/narrator/client.ts) to:
- Resolve LLM configuration from `db.systemConfig` (using Myleague's `sports:llm:*` global settings, or general `narrator:llm:*` / `system:llm:*` keys), or fall back to environment variables (`SPORTS_LLM_API_KEY`, `NARRATOR_LLM_API_KEY`, etc.).
- Provide a `queryLLM` function to call the APIs (Nvidia, OpenRouter, OpenAI) with abort controller timeout limits and `<thinking>` tag cleanup.

Create [flavorization.ts](file:///ixwiki/public/projects/ixstats/src/lib/narrator/flavorization.ts) to:
- Define the CK3 Paradox narrative system prompt, instructing the model to adapt its tone based on the country snapshot metrics.
- Export `getFlavorText({ id, type, title, description, countryId, ctx })`.
- If `countryId` is provided, fetch the current country metrics (approval, stability, government type, GDP, etc.) to inject into the prompt context. For issues, use the issue's existing `contextSnapshot` if present, or fetch the live country data as a fallback.
- Utilize the existing `ExternalApiCache` service (under `service: "custom"`, `type: "json"`) to cache generated flavor texts for 14 days, preventing redundant API calls and credit drain.

### 2.3 Router Addition
Create [narrator.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/narrator/index.ts):
- Add `getFlavorText` query procedure.
- Check both the global system configuration (`narrator:flavor:enabled` defaulting to true) and individual user preference/toggles.
Register this new top-level router in [src/server/api/root.ts](file:///ixwiki/public/projects/ixstats/src/server/api/root.ts) under the namespace `narrator`.

### 2.4 UI Enhancements
Create a shared client component `<ParadoxFlavorCard id={id} type="issue" | "policy" | "decision" title={title} description={description} countryId={countryId} />` under `src/components/narrator/ParadoxFlavorCard.tsx` to:
- Read the user preference toggle from `localStorage` (key `narrator:flavor:enabled`, defaulting to `"true"`).
- Query `api.narrator.getFlavorText`.
- While loading, render a subtle shimmering state ("Drafting Chronicle...").
- Once loaded, render an elegant, amber left-bordered quote card:
  - Font: `font-serif italic text-sm text-slate-300 leading-relaxed`
  - Container: Glassmorphism (`border-amber-500/25 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]`)
  - Include a small toggle button/icon to let the user enable/disable the AI flavor cards (writing to `localStorage`).
- If the model is not configured, the global system setting is disabled, the user disabled it in their preferences, or the fetch fails, degrade gracefully by rendering nothing.

Wire this card into:
- [IssueDetailModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/national-issues/IssueDetailModal.tsx)
- [PolicyDetailSheet.tsx](file:///ixwiki/public/projects/ixstats/src/components/executive/PolicyDetailSheet.tsx)
- [MeetingDetailModal.tsx](file:///ixwiki/public/projects/ixstats/src/components/executive/MeetingDetailModal.tsx) (for decisions)

## 3. Verification Plan

### 3.1 Automated Verification
- Run tests on the toast hook or verify compilation.
- Ensure the app builds without errors.

### 3.2 Manual Verification
- Verify issues toast appears on first session load, but disappears on reload (F5).
- Open an Issue, Policy, or Decision, and watch the Paradox-style flavor text render with a loading state, adapting its narrative tone to the country's metrics, and caching correctly.
- Verify that toggling the card off in the UI successfully updates `localStorage` and hides the card.
