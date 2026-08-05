# Kistan Sandbox tRPC Mutation & Code Cheat Sheet Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new tabs to `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`):
1. **tRPC Mutation Sandbox Tab (`"mutation"`):** Interactive form demonstrating `useMutation()`, `isPending` loading state, Zod validation, and backend response inspection.
2. **JS/TS Cheat Sheet Tab (`"cheatsheet"`):** Categorized reference card gallery (React Hooks, tRPC Queries & Mutations, JS/TS Array/Object operations, Facet UI Tokens) with 1-click code copying.

**Architecture:** Next.js Client Component featuring interactive form state, clipboard API integration, and Facet glass UI styling.

**Tech Stack:** React 19, Next.js 16, TypeScript, Lucide React icons.

## Global Constraints
- **Framework versions:** React 19.2.6, Next.js 16.2.6, Tailwind CSS 4.3.0.
- **Styling:** Semantic Tailwind theme tokens (`bg-card`, `border-border/60`, `text-foreground`, `text-muted-foreground`, `bg-primary`).
- **Compilation:** Clean compilation with zero TypeScript errors.

---

### Task 1: Add tRPC Mutation Sandbox & Cheat Sheet Tabs to Sandbox Page

**Files:**
- Modify: `src/app/labs/sandbox/page.tsx`

- [ ] **Step 1: Implement tRPC Mutation Form State & Interactive Handler**
Add `mutation` tab with test form inputs (e.g. policy motto & priority), simulated/live mutation handler demonstrating pending spinners, Zod validation checks, and response JSON viewer.

- [ ] **Step 2: Implement Categorized Code Cheat Sheet & Copy Handler**
Add `cheatsheet` tab featuring 4 categorized cards (React Hooks, tRPC Pipelines, JS/TS Operations, Facet UI Tokens) with 1-click clipboard copying and toast feedback.

- [ ] **Step 3: Commit and verify compilation**
Run `bun run typecheck:ui` to verify typecheck safety and push to GitHub.
