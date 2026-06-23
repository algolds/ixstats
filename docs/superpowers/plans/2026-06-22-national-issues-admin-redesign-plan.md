# National Issues Admin Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the National Issues Admin page ([page.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/national-issues/page.tsx)) into a sticky two-column layout with inline scrolling, Template CRUD sheets/modals, default template seeding, and a live active issues monitor panel.

**Architecture:** Add two admin procedures (`seedDefaultTemplates` and `getActiveIssues`) to the backend `nationalIssuesEngineRouter`. Reorganize the front-end page layout into a 3-column container where the left-hand column holds system statistics, engine commands, manual force generation/event injection, and seeding forms in a fixed sticky box, and the right-hand column toggles between an inline-scrollable list of templates and a live issues monitoring table.

**Tech Stack:** React, Next.js, tRPC, Prisma, Tailwind CSS, Lucide Icons, Shadcn components (`Button`, `Sheet`, `Badge`, `Select`, `Input`, `Dialog`).

## Global Constraints

- **Package manager**: `bun` (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Database write commands are blocked**: `db:migrate`, `db:push`, `db:reset` exit with error. Use `db:migrate:force` or `db:push:force` only if needed.
- **Active branch**: `v2`.
- Keep router files ≤700 lines. Run `bun run audit:arch` to verify.

---

### Task 1: Backend tRPC additions
Add query `getActiveIssues` and mutation `seedDefaultTemplates` to the National Issues router.

**Files:**
- Modify: `src/server/api/routers/national-issues/engine.ts`

**Interfaces:**
- Consumes: Prisma models `NationalIssueTemplate` and `NationalIssue`.
- Produces: 
  - `getActiveIssues`: Query returning `{ issues: NationalIssue[], nextCursor?: string }`.
  - `seedDefaultTemplates`: Mutation returning `{ created: number, updated: number, errors: number }`.

- [ ] **Step 1: Write backend implementations in engine.ts**
  Open [engine.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/national-issues/engine.ts) and add `getActiveIssues` and `seedDefaultTemplates` to the router definition:
  ```typescript
  // Add to imports at the top
  // import { Category, Priority } from "@prisma/client"; // if needed
  
  // Under adminProcedure section of nationalIssuesEngineRouter:
  
  /**
   * Get all active and recent issues in the world for auditing.
   */
  getActiveIssues: adminProcedure
    .input(
      z.object({
        status: z.string().optional(),
        countryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.status && input.status !== "all") where.status = input.status;
      if (input.countryId && input.countryId !== "all") where.countryId = input.countryId;
      if (input.cursor) where.id = { lt: input.cursor };

      const issues = await ctx.db.nationalIssue.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        include: {
          country: {
            select: { id: true, name: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (issues.length > input.limit) {
        const nextItem = issues.pop();
        nextCursor = nextItem?.id;
      }

      return { issues, nextCursor };
    }),

  /**
   * Seed default templates from the seed file.
   */
  seedDefaultTemplates: adminProcedure.mutation(async ({ ctx }) => {
    // Import from seeds directory
    const { NATIONAL_ISSUE_TEMPLATES } = await import("../../../../../../prisma/seeds/national-issue-templates");

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const template of NATIONAL_ISSUE_TEMPLATES) {
      try {
        const result = await ctx.db.nationalIssueTemplate.upsert({
          where: { slug: template.slug },
          update: {
            title: template.title,
            description: template.description,
            longDescription: template.longDescription ?? null,
            domain: template.domain,
            category: template.category as any,
            tags: template.tags ?? null,
            baseSeverity: template.baseSeverity as any,
            baseUrgency: template.baseUrgency,
            deadlineDaysBase: template.deadlineDaysBase,
            triggerConditions: template.triggerConditions,
            cooldownDays: template.cooldownDays,
            maxActivePerCountry: template.maxActivePerCountry,
            responseOptions: template.responseOptions,
            followUpTemplateIds: template.followUpTemplateIds ?? null,
            personalityModifiers: template.personalityModifiers ?? null,
            isActive: true,
          },
          create: {
            slug: template.slug,
            title: template.title,
            description: template.description,
            longDescription: template.longDescription ?? null,
            domain: template.domain,
            category: template.category as any,
            tags: template.tags ?? null,
            baseSeverity: template.baseSeverity as any,
            baseUrgency: template.baseUrgency,
            deadlineDaysBase: template.deadlineDaysBase,
            triggerConditions: template.triggerConditions,
            cooldownDays: template.cooldownDays,
            maxActivePerCountry: template.maxActivePerCountry,
            responseOptions: template.responseOptions,
            followUpTemplateIds: template.followUpTemplateIds ?? null,
            personalityModifiers: template.personalityModifiers ?? null,
            isActive: true,
            authorId: ctx.auth?.userId ?? null,
          },
        });

        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        errors++;
        console.error(`Error seeding default template "${template.slug}":`, err);
      }
    }

    return { created, updated, errors };
  }),
  ```

- [ ] **Step 2: Verify typecheck of backend sub-project**
  Run: `bun run typecheck:server`
  Expected: PASS

- [ ] **Step 3: Commit backend changes**
  Run: `git commit -am "feat: add getActiveIssues and seedDefaultTemplates to nationalIssues tRPC router"`

---

### Task 2: Redesign the Left Column (Engine Stats, Seeding, Evaluate Engine, Force Gen, Inject Event)
Refactor the client side to introduce a column grid structure, placing stats and engine action forms in a fixed/scrollable sidebar on the left.

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`

**Interfaces:**
- Consumes: `api.nationalIssues.getGenerationStats`, `api.nationalIssues.triggerEvaluation`, `api.nationalIssues.seedDefaultTemplates`, `api.nationalIssues.forceGenerate`, `api.nationalIssues.injectEvent`.

- [ ] **Step 1: Restructure Layout & Implement Seeding Trigger**
  In [page.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/national-issues/page.tsx):
  - Setup a sidebar layout: Left column width `col-span-1` and Right column width `col-span-2` inside a viewport-capped grid.
  - Implement a Seed Button utilizing the `api.nationalIssues.seedDefaultTemplates.useMutation` mutation. Add feedback/toast on success or error.
  - Move the Stats card, Seeding actions, Evaluate Engine trigger, Force Gen card, and Inject Event card inside the Left Column.

- [ ] **Step 2: Add inline bulk import JSON tool**
  Add a collapsible JSON input form in the Left Column to paste a JSON array of templates for bulk upload using the `api.nationalIssues.batchCreateTemplates.useMutation` mutation.

- [ ] **Step 3: Verify build compiles**
  Run: `bun run typecheck:ui`
  Expected: PASS

---

### Task 3: Redesign the Right Column (Workspace Toggle, Filters, Inline Scrollable Template List)
Expose workspace toggles and ensure the template list scrolls inline rather than page-wide.

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`

**Interfaces:**
- Consumes: `api.nationalIssues.getTemplates`, `api.nationalIssues.toggleTemplateActive`, `api.nationalIssues.deleteTemplate`, `api.nationalIssues.previewTemplate`.

- [ ] **Step 1: Set scroll bounds & toggle header**
  Create a filter/header panel containing tabs: "Templates Manager" and "Active Issues Monitor". Set the templates list container to a fixed height scroll pane (`max-h-[calc(100vh-250px)] overflow-y-auto pr-1 scrollbar-thin`).

- [ ] **Step 2: Implement Template Actions**
  Ensure each template card features:
  - Domain, severity, and urgency badges.
  - Interactive switches to activate/deactivate (via `toggleTemplateActive.mutate`).
  - Eye icon button opening preview modal with variable substitution.
  - Trash icon button deleting template on confirmation (via `deleteTemplate.mutate`).
  - Edit button trigger (to open the CRUD Dialog, implemented in Task 5).

- [ ] **Step 3: Verify compile succeeds**
  Run: `bun run typecheck:ui`
  Expected: PASS

---

### Task 4: Active Issues Monitor Panel
Create the monitor table to track live/pending/expired issues in the simulation.

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`

**Interfaces:**
- Consumes: `api.nationalIssues.getActiveIssues`.

- [ ] **Step 1: Add getActiveIssues query hook & filters**
  Add a state hook for selected status filter (`all`, `pending`, `viewed`, `responded`, `expired`) and country ID filter.
  Fetch active issues:
  ```typescript
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [activeCountryFilter, setActiveCountryFilter] = useState("all");
  
  const { data: activeIssuesData, refetch: refetchActiveIssues } = api.nationalIssues.getActiveIssues.useQuery({
    status: activeStatusFilter !== "all" ? activeStatusFilter : undefined,
    countryId: activeCountryFilter !== "all" ? activeCountryFilter : undefined,
  });
  ```

- [ ] **Step 2: Render live monitor workspace**
  When the "Active Issues Monitor" tab is active:
  - Display country and status filter select inputs.
  - Render a table showing Country, Issue Title, Severity, Urgency, Status Badge (green for responded, amber for pending/viewed, red for expired/auto-resolved), Chosen Option, and Responded/Created timestamps.

- [ ] **Step 3: Verify compilation**
  Run: `bun run typecheck:ui`
  Expected: PASS

---

### Task 5: Template CRUD (Create and Edit Dialog/Sheet Form)
Implement full dialog-based CRUD forms for template creation and update, including trigger and choice JSON verification.

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`
- Create Sheet or Dialog components inside page.tsx.

**Interfaces:**
- Consumes: `api.nationalIssues.createTemplate`, `api.nationalIssues.updateTemplate`.

- [ ] **Step 1: Build Dialog CRUD structure & fields**
  Expose a `Sheet` or `Dialog` styled in the Facet design system. Add text inputs/select options for:
  - Slug (unique, lowercase only)
  - Title & Description
  - Long Description (optional textarea)
  - Domain (Select economic | political | social | military | diplomatic | infrastructure | environmental)
  - Base Severity (Select critical | high | medium | low)
  - Base Urgency (Input/Slider 0-100)
  - Cooldown Days & Max Active Per Country
  - Category (governance | economic | diplomatic | social | security | infrastructure)

- [ ] **Step 2: Add JSON fields validation & helpers**
  - Textarea for `Trigger Conditions` JSON. Parse on change and show validation indicator (e.g. "✓ Valid JSON" or "✗ Invalid JSON format").
  - Textarea for `Response Options` JSON. Add a "Load Option Template" helper button that inserts a default response option structure:
    ```json
    [
      {
        "id": "option_id",
        "label": "Option Title {{countryName}}",
        "description": "Action description text.",
        "consequences": [
          {
            "targetModel": "Country",
            "targetField": "publicApproval",
            "operation": "add",
            "value": 5
          }
        ],
        "previewEffects": {
          "publicApproval": 5
        },
        "outcomeText": "Outcome resolution description."
      }
    ]
    ```

- [ ] **Step 3: Hook up CRUD mutations & validation gates**
  Disable the "Save" submit button if the JSON inputs are invalid. Hook up `createTemplate.useMutation` and `updateTemplate.useMutation` showing a toast message upon completion, then closing the sheet and refetching the template list.

- [ ] **Step 4: Verify typecheck**
  Run: `bun run typecheck`
  Expected: PASS

---

### Task 6: Auditing and Theme Polish
Complete theme polishing to match the **Facet** design system and verify file boundaries.

**Files:**
- Modify: `src/app/admin/national-issues/page.tsx`

- [ ] **Step 1: Audit and verify page.tsx style tokens**
  Verify all component wrappers use correct Facet tailwind style classes:
  - Replace any solid backgrounds (`bg-white`, `bg-slate-900`) with glass surfaces: `bg-white/5 border-white/10 backdrop-blur-md` (or `bg-black/40` in dark mode).
  - Use `text-muted-foreground` and HSL theme variables.
  - Verify that the total line count of `src/app/admin/national-issues/page.tsx` is clean and does not exceed architectural guardrails, or split auxiliary sub-components (like `TemplateEditorForm`) if it grows past 700 lines.

- [ ] **Step 2: Run final validation suite**
  Run: `bun run typecheck`
  Run: `bun run lint`
  Run: `bun run audit:arch`
  Expected: All checks PASS with zero errors.

- [ ] **Step 3: Commit and push changes**
  Run: `git commit -am "feat: finalize national issues admin redesign with two-column responsive layout, live issues monitor, default seeding, and template CRUD sheet"`
