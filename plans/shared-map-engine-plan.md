# Shared Map Engine — "load once, reuse everywhere, keep interactivity"

**Repo:** `/ixwiki/public/projects/ixstats` · **Branch:** `v2` · Package manager **bun** ·
`maplibre-gl@5.24`. Current state: every surface builds its **own** standalone MapLibre instance and
destroys it on unmount (clean base after the singleton + snapshot rip-out on 2026-07-01).

## What we actually want
The map "loads once" and every surface — **main map, map editor, world editor, dashboard/MyCountry
embeds, wiki embeds** — reuses that work, while embeds stay **fully interactive**. Most performant &
effective combo, not dogmatically "one instance."

## The reframe (measured facts, not assumptions)
1. **Data already loads once.** `getWorldMap` / `getCountryGeoBundle` are React-Query cached by key
   (30-min stale), shared across all 12+ consumers. `filterByArea` memoizes parsed FCs in a `WeakMap`.
   Network + JSON parse are already amortized. **Do not rebuild a "data cache" — it exists.**
2. **The real cost** of today's standalone model is per **instance**: a WebGL context (~8–16/page hard
   cap), a fresh GPU upload of the same geometry, and map init (style/glyphs/sprites — HTTP-cached but
   still re-applied). And we **throw the instance away on every route change**, so /maps → /mycountry →
   /maps re-inits from scratch.
3. **Hard physical limit:** one `<canvas>`/WebGL context = one viewport. Two embeds showing different
   countries at different zooms **simultaneously** cannot share one context. "One instance for
   everything visible at once" is impossible; "one warm instance **per role**, reused across time" is
   the achievable win.

⇒ The goal is **instance persistence + reuse + bounding**, not a single global canvas.

## Architecture: role-keyed warm instance manager

A **module-level singleton** (NOT a React context — see Lesson 1) that owns a few long-lived MapLibre
instances, parked in hidden holders when idle and moved into a surface's container when mounted.

```
src/lib/maps/map-engine.ts        # the manager: roles, pool, acquire/release, ready promises
src/hooks/useMapSurface.ts        # thin React hook: stable acquire on mount, release on unmount
```

**Roles** (each is one persistent instance, created lazily, kept warm, never destroyed on unmount):

| Role | Surfaces | Style/layers |
|------|----------|--------------|
| `world` | main map (`/maps`), world editor | full political + decorative world layers (heavy) |
| `editor` | country map editor | editor style + edit layers |
| `embed:*` | dashboard/MyCountry hero, wiki infobox, country cards | light political + single-country layers |

**Embeds use a small bounded pool** (`embed` role = pool of N=3 warm instances, LRU). A mounting embed
borrows the least-recently-used free instance, **swaps its GeoJSON source data** to the new country
(`source.setData(...)` — cheap, no style reload), and re-fits bounds. Returning an embed to the pool
keeps it warm. This is the crux of "load once": the 2nd, 3rd… embed reuse an already-initialized map
and only push new *feature data*, never re-init style/glyphs/context.

**Manager API (stable, imported directly — no changing identities):**
```ts
// map-engine.ts
type Role = "world" | "editor" | "embed";
interface AcquireOpts { container: HTMLElement; view?: {...}; interactive?: boolean;
                        style?: StyleKind; onReady?: (map: Map) => void; }
acquireSurface(role: Role, surfaceKey: string, opts: AcquireOpts): SurfaceHandle
// SurfaceHandle = { ready: Promise<Map>; map(): Map|null; release(): void }
```
- `acquireSurface` returns synchronously with a **`ready` promise** that resolves once the borrowed
  instance's style is loaded AND it's attached to `opts.container` and resized. Callers `await handle.ready`
  (or use `onReady`) — **never poll** (Lesson 2).
- The manager pre-creates instances lazily and **warms `world` + one `embed` on idle**
  (`requestIdleCallback`) after first paint, extending today's `MapPrefetcher` (which already warms the
  data) to also warm an instance.

**Re-parenting, done right:** the manager moves an instance's container node into `opts.container`
(`appendChild`) then calls `map.resize()` after a rAF. Because there are **multiple** instances (pool),
simultaneous surfaces never fight over one node — the failure that sank the old singleton.

## Surface integration (what changes per file)
- `IxWorldMap.tsx` → acquire `world`; keep existing theme/projection effect (it already `setStyle`s on
  the live map). On unmount: `release()` (park warm) instead of `map.remove()`.
- `EditorMap.tsx` / world editor → acquire `editor`; same lifecycle. Editor's heavy edit layers live on
  its dedicated instance so they never touch `world`/embeds.
- `useCountryMapEmbedLayers.ts` (CountryMapEmbed) → acquire `embed`; build country/neighbor/city layers
  on the borrowed instance; on release, **remove only this embed's layers/sources** (helper already
  exists: `cleanupEmbedLayers`) so the pooled instance returns clean for the next borrower.
- `CoordinatesMapEmbed.tsx` (wiki) → acquire `embed`; it already lazy-mounts via IntersectionObserver —
  keep that; it becomes the **overflow control** (below).

## Simultaneity & overflow (wiki articles, long lists)
Pool cap = N (start N=3, tune). On a page with ≤N visible maps: all live & interactive. With >N
(e.g., a wiki article with 6 map tags):
1. **IntersectionObserver-gate** every embed (only mount when near viewport) — already in
   `CoordinatesMapEmbed`, extend to `CountryMapEmbed`. In practice ≤N are on-screen at once.
2. If still >N truly-visible, LRU-evict the least-recently-*interacted* embed to a **static snapshot**
   (`canvas.toDataURL()` before returning it to the pool) and show that PNG until it scrolls back /
   is clicked → re-borrow a live instance. This is the *only* place snapshots survive from the previous
   attempt, and only as an overflow valve — the default is live + interactive.

## Lessons-learned safeguards (each past failure → prevention)
1. **Context-value churn looped every embed** (memoized-too-late `acquireMap`). → Manager is a
   **module singleton**; components import stable functions. No provider value to re-identify. The React
   hook returns refs, never a fresh callback in deps.
2. **Cold-load poller leak / embeds never became ready.** → No polling anywhere. Readiness is a single
   awaited `Promise` per acquire, resolved on `style.load`+attach+resize; the promise is stored so
   concurrent acquires of the same surface share it; release rejects/cancels cleanly.
3. **Single canvas → only one embed rendered, others spun forever.** → Bounded **pool** of instances;
   each simultaneous surface gets its own. Never one node for many slots.
4. **Map editor load issues (setStyle races, blank canvas).** → Editor gets a **dedicated persistent
   instance**; style is set once at creation, theme changes via the existing guarded `setStyle` effect;
   acquire waits for `style.load` before running edit-layer setup. StrictMode double-invoke tolerated
   (acquire/release idempotent, keyed by surfaceKey).
5. **"Shared instance didn't instantly load embeds."** → Embeds borrow a **pre-warmed** pooled instance
   and only `setData` (data already in RQ cache) → first paint is a data push, not an init. Target
   <100ms from mount to painted for a warm borrow.
6. **Re-parent resize glitches.** → `resize()` on rAF after attach + a `ResizeObserver` per surface
   (already present in embed state hook).

## Status
- **P0 + P1 DONE** (v2, 2026-07-01). `src/lib/maps/map-engine.ts` — per-role (`world`, `editor`)
  persistent instances, parked in a hidden holder on release (not destroyed), awaited `ready` promise
  (no polling), unique-id acquire (StrictMode-safe), style-reset-on-reacquire, dev instrumentation
  (`console.info` init timing + `window.__mapEngine.getStats()` live-context count). `IxWorldMap` →
  `acquireSurface("world")`, `EditorMap` → `acquireSurface("editor")`; both park on unmount. Embeds &
  wiki maps UNCHANGED (standalone) — that's P2. Lint clean; only these two files import the engine.
- **P2–P4 TODO** (below).

## Phasing (each ships independently; measure between)
- **P0 — Instrument.** Add a dev-only counter of live WebGL contexts + map init timings (console/HUD).
  Establishes the baseline the rest is judged against.
- **P1 — Persistence for the two big singletons (biggest win, lowest risk).** `map-engine` with roles
  `world` + `editor` only (no pool yet); `IxWorldMap`/`EditorMap` acquire+park instead of create/destroy.
  Delivers "load once" across navigation for the main map & editor immediately. Embeds untouched
  (still standalone).
- **P2 — Embed pool.** Add `embed` role pool (N=3) + `setData` reuse; migrate `CountryMapEmbed` &
  `CoordinatesMapEmbed` to borrow. Keep their IntersectionObserver lazy-mount.
- **P3 — Overflow valve.** Snapshot-on-evict for >N visible; click/scroll re-promote.
- **P4 — Warm-on-idle + tuning.** Extend `MapPrefetcher` to pre-create `world`+1 `embed` on idle; tune
  N, LRU, and holder GC. Delete dead paths; lint/typecheck.

## Non-goals / do-not
- **No single global canvas / DOM re-parent of ONE instance** (the `SharedMapContext` model — deleted,
  do not resurrect; see memory `project_map_standalone_architecture`).
- No new data cache (React Query already is it).
- No non-interactive-by-default embeds (user wants interactivity; snapshots are overflow-only).

## Risks / watch
- Pooled instance **state bleed**: a borrower must remove exactly its own layers/sources on release;
  add a dev assert that a released `embed` instance has only base layers left.
- Two embeds requesting the pool in the same tick when only N-1 free → queue the (N+1)th behind an LRU
  eviction; must not deadlock (timeout → snapshot).
- Memory: N warm instances hold GPU buffers forever. Cap N; GC the pool if the tab is backgrounded long.
- `world` heavy layers on a parked instance still hold VRAM; acceptable for 1 instance, monitor.
