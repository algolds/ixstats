# 060 — Optimize IntentComposer Interactive Click Responsiveness

- **Status**: DONE
- **Commit**: 397885d6
- **Severity**: MEDIUM
- **Category**: 3. Physicality & Origin / 2. Easing & Duration
- **Estimated scope**: 1 file (src/components/mycountry/primitives/IntentComposer.tsx)

## Problem

In the [IntentComposer](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx) component, both the suggestion goal chips [IntentComposer.tsx:168](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx#L168) and proposed government tiers [IntentComposer.tsx:205](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx#L205) act as primary clickable triggers. Currently:
1. **Unresponsive click feel**: They use `active:scale-[0.99]`, which represents a scale change of only 1%. This is practically invisible and does not provide tactile press feedback.
2. **Sluggish transition properties**: They use `transition-all duration-200` with standard Tailwind ease-in-out curve. This delays the scale reduction, making the tap feel soft, heavy, and mushy.

```tsx
/* src/components/mycountry/primitives/IntentComposer.tsx:168 — current */
className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-left hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all duration-200 active:scale-[0.99] cursor-pointer"

/* src/components/mycountry/primitives/IntentComposer.tsx:205 — current */
className="border-white/5 bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.04] w-full rounded-xl border px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-lg"
```

## Target

1. Target transitions specifically to `border-color`, `background-color`, and `transform`.
2. Speed up click transition timing to `100ms` / `150ms` and replace default sluggish easing with a crisp, physical `ease-out` curve.
3. Set the active press scale to `scale-[0.97]` for responsive physical feedback.

```tsx
/* target suggestion chip classes */
className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-left hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer"

/* target proposed tier button classes */
className="border-white/5 bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.04] w-full rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-lg"
```

## Repo conventions to follow

- Hover/Active states should use fast, responsive easing.
- Tactile scales on interactive elements stay in the `0.95` to `0.98` range.

## Steps

1. In [IntentComposer.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx), locate line 168:
   ```tsx
   className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-left hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all duration-200 active:scale-[0.99] cursor-pointer"
   ```
2. Replace it with:
   ```tsx
   className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-left hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer"
   ```
3. In [IntentComposer.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx), locate line 205:
   ```tsx
   className="border-white/5 bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.04] w-full rounded-xl border px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-lg"
   ```
4. Replace it with:
   ```tsx
   className="border-white/5 bg-white/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.04] w-full rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-lg"
   ```

## Boundaries

- Do NOT touch the state variables or conditional rendering of chips.
- Do NOT touch form inputs or event submissions.

## Verification

### Mechanical
- Run Next/UI typechecks:
  ```bash
  bun run typecheck:ui
  ```
- Run standard linter:
  ```bash
  bun run lint
  ```

### Feel check
- Open the `/mycountry` Executive section, click on the Intent Composer text area or input to generate suggestion chips.
- Hover and press down on the suggestion chips and proposals. Confirm:
  - The chips feel significantly lighter and snap into the active state on press.
  - The active depth (`0.97`) is physically discernible, giving clear visual validation of click registration.

- **Done when**: `IntentComposer.tsx` compiles cleanly and suggestion items respond to mouse-clicks with `scale-[0.97]` at `150ms ease-out` timing.
