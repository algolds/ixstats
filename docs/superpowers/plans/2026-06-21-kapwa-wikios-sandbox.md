# Kapwa WikiOS Sandbox Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a scoped, experimental playground at `/wiki/sandbox` that integrates the Kapwa design system with the WikiOS application, utilizing live data from tRPC queries, scoped Tailwind CSS v4 variables, and custom Facet theme overrides.

**Architecture:** We will install `@bettergov/kapwa` via Bun, scope its CSS variables inside a `.kapwa-sandbox` class to prevent global variable leaks, and map its semantic properties to WikiOS theme variables. We will then build an isolated client-side sandbox page at `/wiki/sandbox` with three tabbed simulators: Playground, Recent Changes, and Stash Manager.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, tRPC 11, `@bettergov/kapwa` (NPM package)

## Global Constraints
- **Package manager:** Use `bun` exclusively (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Global typechecking:** Do NOT run split typecheck scripts or global tsc in this session.
- **Active branch:** `v2`.

---

### Task 1: Package Installation & CSS Variable Scoping

**Files:**
- Modify: `package.json`
- Create: `src/styles/wiki-os/kapwa-scoped.css`
- Modify: `src/styles/wiki-os.css`

**Interfaces:**
- Consumes: None
- Produces: CSS class `.kapwa-sandbox` providing scoped Kapwa token styling and Facet glass overlays.

- [ ] **Step 1: Install Kapwa npm package**
  
  Run:
  ```bash
  bun add @bettergov/kapwa@latest
  ```
  Expected: Successful installation and updates to `package.json` and `bun.lock`.

- [ ] **Step 2: Create the scoped stylesheet**
  
  Create file `src/styles/wiki-os/kapwa-scoped.css` with the following CSS:
  ```css
  /* Scoped Kapwa and Facet Theme Mapping */
  .kapwa-sandbox {
    @import "@bettergov/kapwa/kapwa.css";

    /* Core Canvas/Surface Color Mapping */
    --color-kapwa-bg-canvas: var(--wikios-bg);
    --color-kapwa-bg-surface: var(--wikios-surface);
    --color-kapwa-border-default: var(--wikios-border);
    --color-kapwa-text-default: var(--wikios-text);
    --color-kapwa-text-muted: var(--wikios-text-muted);
    --color-kapwa-text-dim: var(--wikios-text-dim);

    /* Accents & Link Mapping */
    --color-kapwa-brand-600: var(--wikios-accent);
    --color-kapwa-brand-500: var(--wikios-accent-hover);
    --color-kapwa-link-default: var(--wikios-link);

    /* Volumetric Translucent Card Backgrounds */
    --color-kapwa-bg-card: rgba(30, 32, 40, 0.45);
    --color-kapwa-shadow-card: 0 4px 30px rgba(0, 0, 0, 0.2);
  }

  /* Volumetric satin glass overrides for Kapwa card elements inside the sandbox */
  .kapwa-sandbox .kp-card {
    backdrop-filter: blur(16px) saturate(150%);
    border: 1px solid var(--wikios-border) !important;
    border-radius: 8px;
    position: relative;
    background: var(--color-kapwa-bg-card) !important;
  }

  /* Scoped glare sheen overlay for Kapwa cards (Facet Refraction Overlay) */
  .kapwa-sandbox .kp-card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.08),
      rgba(255, 255, 255, 0.02)
    );
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: xor;
    -webkit-mask-composite: xor;
    pointer-events: none;
  }
  ```

- [ ] **Step 3: Register the scoped stylesheet in the entrypoint**
  
  Modify `src/styles/wiki-os.css` by appending the import line:
  ```css
  @import "./wiki-os/kapwa-scoped.css";
  ```
  *(Add to the very end of the file).*

- [ ] **Step 4: Commit changes**
  
  Run:
  ```bash
  git add package.json bun.lock src/styles/wiki-os.css src/styles/wiki-os/kapwa-scoped.css
  git commit -m "style: install @bettergov/kapwa and configure scoped css mapping"
  ```


---

### Task 2: Build Sandbox Page & Component Playground

**Files:**
- Create: `src/app/(wiki-os)/wiki/sandbox/page.tsx`

**Interfaces:**
- Consumes: `WikiOSLayout` from `~/components/wiki-os/shared/WikiOSLayout`
- Produces: The route `/wiki/sandbox` showing the playground tab with custom controls.

- [ ] **Step 1: Create the sandbox page component**
  
  Create file `src/app/(wiki-os)/wiki/sandbox/page.tsx` with the following skeleton layout:
  ```tsx
  "use client";

  import { useState } from "react";
  import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
  import { Button } from "~/components/ui/button";
  import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
  import { Badge } from "~/components/ui/badge";

  type SandboxTab = "playground" | "recent-changes" | "stashes";

  export default function WikiSandboxPage() {
    const [activeTab, setActiveTab] = useState<SandboxTab>("playground");

    return (
      <WikiOSLayout title="Kapwa Sandbox">
        <div className="kapwa-sandbox flex flex-col gap-6 p-4">
          {/* Experimental Notice */}
          <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-500">
            <AlertTitle className="font-bold">Kapwa Trial Sandbox</AlertTitle>
            <AlertDescription className="text-xs">
              This sandbox is a scoped visual integration test comparing Kapwa components in the WikiOS environment.
            </AlertDescription>
          </Alert>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-3">
            {(["playground", "recent-changes", "stashes"] as SandboxTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === tab
                    ? "bg-[var(--wikios-accent)] text-white"
                    : "text-[var(--wikios-text-muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {tab.replace("-", " ").toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Renderers */}
          {activeTab === "playground" && (
            <div className="flex flex-col gap-6">
              {/* Component playground container */}
              <div className="kp-card p-5 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-[var(--wikios-text)]">Kapwa Component Playground</h3>
                <p className="text-xs text-[var(--wikios-text-muted)]">
                  These components are imported from the Kapwa package but inherit WikiOS/Facet styling contract rules.
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  <button className="px-4 py-2 bg-[var(--wikios-accent)] hover:bg-[var(--wikios-accent-hover)] text-white text-xs font-bold rounded transition-colors">
                    Kapwa Primary Button
                  </button>
                  <button className="px-4 py-2 border border-[var(--wikios-border)] text-[var(--wikios-text)] text-xs font-bold rounded hover:bg-white/5 transition-colors">
                    Kapwa Secondary Button
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "recent-changes" && (
            <div className="text-center py-10 text-xs text-[var(--wikios-text-dim)]">
              Recent Changes Simulator (Live Data)
            </div>
          )}

          {activeTab === "stashes" && (
            <div className="text-center py-10 text-xs text-[var(--wikios-text-dim)]">
              Stash Manager Simulator (Live Data)
            </div>
          )}
        </div>
      </WikiOSLayout>
    );
  }
  ```

- [ ] **Step 2: Run build check to verify route compiles**
  
  Run:
  ```bash
  bun run build
  ```
  Expected: Successful compilation without type or directory reference errors.

- [ ] **Step 3: Commit page scaffold**
  
  Run:
  ```bash
  git add src/app/\(wiki-os\)/wiki/sandbox/page.tsx
  git commit -m "feat: create sandbox route and playground tab scaffold"
  ```

---

### Task 3: Implement Recent Changes Live Simulator

**Files:**
- Modify: `src/app/(wiki-os)/wiki/sandbox/page.tsx`

**Interfaces:**
- Consumes: `api.wikios.getRecentChanges.useQuery` tRPC query.
- Produces: Simulated recent-changes timeline utilizing themed Kapwa layout containers.

- [ ] **Step 1: Implement the Recent Changes simulator tab**
  
  Replace the `"recent-changes"` tab renderer in `src/app/(wiki-os)/wiki/sandbox/page.tsx` with the following code to retrieve and list recent edits:
  ```tsx
  {activeTab === "recent-changes" && (
    <RecentChangesSimulator />
  )}
  ```
  And define the `RecentChangesSimulator` helper component inside the same file:
  ```tsx
  import { api } from "~/trpc/react";
  import { Clock, FileText, FilePlus } from "lucide-react";
  import { formatMWTimeAgo } from "~/lib/wiki-os/mediawiki-timestamp";

  function RecentChangesSimulator() {
    const { data: changes, isLoading } = api.wikios.getRecentChanges.useQuery(
      { limit: 15 },
      { staleTime: 30_000 }
    );

    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--wikios-accent)]" />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="kp-card p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-[var(--wikios-text)]">Recent WikiOS Activity</h3>
            <span className="text-[10px] text-[var(--wikios-text-dim)]">Simulated live timeline</span>
          </div>

          <div className="flex flex-col gap-3">
            {changes?.map((change, idx) => {
              const diff = (change.newLen ?? 0) - (change.oldLen ?? 0);
              const diffSign = diff > 0 ? "+" : "";
              const diffClass = diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-muted-foreground/60";

              return (
                <div key={idx} className="flex items-start justify-between p-3 border border-white/5 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-start gap-2.5">
                    {change.type === "new" ? (
                      <FilePlus className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-[var(--wikios-text)] hover:underline cursor-pointer block truncate">
                        {change.title}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--wikios-text-muted)]">
                        <span className="font-bold">{change.user}</span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {formatMWTimeAgo(change.timestamp)}</span>
                      </div>
                      {change.comment && (
                        <p className="text-[10px] text-[var(--wikios-text-dim)] italic mt-1 leading-relaxed line-clamp-1">
                          "{change.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-semibold shrink-0 mt-0.5 ${diffClass}`}>
                    ({diffSign}{diff.toLocaleString()})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit changes**
  
  Run:
  ```bash
  git add src/app/\(wiki-os\)/wiki/sandbox/page.tsx
  git commit -m "feat: implement Recent Changes live data simulator in Kapwa sandbox"
  ```

---

### Task 4: Implement Stash Manager Live Simulator

**Files:**
- Modify: `src/app/(wiki-os)/wiki/sandbox/page.tsx`

**Interfaces:**
- Consumes: `api.wikios.getStashes.useQuery` tRPC query.
- Produces: Visual representation of stashes styled with Kapwa card layout and Facet elevations.

- [ ] **Step 1: Implement the Stash Manager simulator tab**
  
  Replace the `"stashes"` tab renderer in `src/app/(wiki-os)/wiki/sandbox/page.tsx` with the following component mapping:
  ```tsx
  {activeTab === "stashes" && (
    <StashesSimulator />
  )}
  ```
  And define the helper component `StashesSimulator` at the bottom of the same file:
  ```tsx
  import { FolderOpen, Bookmark, Hash } from "lucide-react";
  import { useFacetDepth } from "~/components/ui/facet-container";

  function StashesSimulator() {
    const { data: stashes, isLoading } = api.wikios.getStashes.useQuery();

    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--wikios-accent)]" />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-[var(--wikios-text)]">My Stash Folders</h3>
          <span className="text-[10px] text-[var(--wikios-text-dim)]">Simulated live stashes</span>
        </div>

        {stashes && stashes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stashes.map((stash) => (
              <StashCard key={stash.id} stash={stash} />
            ))}
          </div>
        ) : (
          <div className="kp-card p-8 flex flex-col items-center justify-center text-center gap-3">
            <FolderOpen className="h-10 w-10 text-[var(--wikios-text-dim)] opacity-20" />
            <h4 className="text-xs font-semibold text-[var(--wikios-text)]">No Stashes Found</h4>
            <p className="text-[10px] text-[var(--wikios-text-muted)] max-w-xs">
              Go save some wiki pages or forum posts to load collections here.
            </p>
          </div>
        )}
      </div>
    );
  }

  function StashCard({ stash }: { stash: { id: string; name: string; color: string; itemCount: number } }) {
    // Dynamic Facet glass elevation hook
    const { depth, increaseDepth, resetDepth } = useFacetDepth(1);

    return (
      <div
        onMouseEnter={increaseDepth}
        onMouseLeave={resetDepth}
        className="kp-card p-4 flex flex-col gap-3 transition-transform cursor-pointer"
        style={{
          transform: depth > 1 ? "translateY(-2px)" : "none",
          borderColor: stash.color ? `${stash.color}25` : "var(--wikios-border)"
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ background: stash.color || "var(--wikios-accent)" }}
            />
            <span className="text-xs font-bold text-[var(--wikios-text)]">{stash.name}</span>
          </div>
          <span className="text-[10px] text-[var(--wikios-text-muted)] flex items-center gap-0.5">
            <Hash className="h-3 w-3" /> {stash.itemCount} items
          </span>
        </div>
        <p className="text-[10px] text-[var(--wikios-text-dim)]">
          Scoped collection. Click to open and annotate stashed records.
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit changes**
  
  Run:
  ```bash
  git add src/app/\(wiki-os\)/wiki/sandbox/page.tsx
  git commit -m "feat: implement Stash Manager live data simulator with Facet elevation depth"
  ```
