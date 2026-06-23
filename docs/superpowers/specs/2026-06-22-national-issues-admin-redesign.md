# Design Spec: National Issues Admin Panel Redesign

## Purpose
The National Issues Admin panel ([page.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/national-issues/page.tsx)) provides system owners and admins with control over the simulation's dynamic decision/event engine. Currently, it is a single long page where the list of templates, statistics, and simulation control tools flow vertically, leading to heavy scrolling as the template library grows. Additionally, the panel lacks robust CRUD capability (creating, updating, and deleting templates from the UI), global engine triggers, and a monitoring view for active issues in the world.

To address these needs, we will redesign the National Issues Admin page to:
1. Implement a **Split-Screen Column Layout** (**Option A**) using the **Facet** design system (compliant with dynamic dark/light modes, premium glass aesthetics, and viewport boundaries).
2. Set the template list to a viewport-restricted container with **inline scroll** to keep controls fixed and accessible.
3. Integrate **Global Engine & Seeding** controls (including a backend-supported template sync mutation).
4. Implement full **Template CRUD** with JSON validation for complex conditions and consequence templates.
5. Create an **Active Issues Monitor** allowing admins to audit live/pending/expired issues across the world's nations.

---

## Technical Details

### 1. Viewport & Grid Layout Redesign
* **File:** [page.tsx](file:///ixwiki/public/projects/ixstats/src/app/admin/national-issues/page.tsx)
* **Design Pattern:** A full-height split viewport (`h-[calc(100vh-64px)]` or full screen container) divided into a two-column grid:
  * **Left Column (Width: 1/3, `sticky` / fixed position):**
    * **Engine Stats Panel**: Shows overall engine counters (evaluations, generated count, average execution time, etc.) using metrics fetched from `getGenerationStats`.
    * **System Control & Seeding Card**:
      * *Evaluate Engine*: Triggers manual evaluation (`api.nationalIssues.triggerEvaluation`) for a selected country (from dropdown) or all countries.
      * *Seed Default Templates*: Single-click button triggering server-side template synchronization.
    * **Manual Operations (Force Gen & Event Injector)**:
      * Forms to force-generate an issue for a country, or inject scope-based events (Country, Region, Continent, All).
  * **Right Column (Width: 2/3, flex-layout main work area):**
    * **Workspace Toggle & Filters**:
      * Tabs to switch between **Templates Manager** and **Active Issues Monitor**.
      * Text search, domain filter dropdown, and count badges.
    * **Inline Scroll Container**:
      * Sized using CSS (`max-h-[calc(100vh-250px)] overflow-y-auto`) to ensure it scrolls independently from the rest of the page.
      * Under **Templates Manager**: Renders the template cards with domain, severity, urgency, active instances counter, and actions (Preview, Toggle Active, Edit, Delete).
      * Under **Active Issues Monitor**: Renders a paginated table of active/recent issues in the world, with status indicator (pending, responded, auto_resolved, expired), country name, creation time, and response selected.

### 2. tRPC Backend API Additions
To enable light-weight default seeding from backend seeds without loading massive lists on the client side, we will add a new endpoint to the national issues engine router:
* **File:** [engine.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/national-issues/engine.ts)
* **Changes:**
  * Add procedure `seedDefaultTemplates: adminProcedure.mutation(...)`.
  * Import `NATIONAL_ISSUE_TEMPLATES` from [national-issue-templates.ts](file:///ixwiki/public/projects/ixstats/prisma/seeds/national-issue-templates.ts).
  * Loop through the seed templates and upsert them:
    ```typescript
    const result = await ctx.db.nationalIssueTemplate.upsert({
      where: { slug: template.slug },
      update: { ...template },
      create: { ...template, authorId: ctx.auth!.userId }
    });
    ```
  * Return count of created, updated, and failed templates.
  * Register the new procedure in the router exports.

### 3. Template CRUD Dialog Editor & JSON Validator
* **Component Location:** Expose a side sheet (using Shadcn UI `<Sheet>` or `<Dialog>`) for creating and editing templates.
* **Fields:**
  * Slug, Title, Description, Long Description.
  * Domain (Select), Category (Select), Base Severity (Select), Base Urgency (Slider/Input), Cooldown Days, Max Active Per Country.
  * **Trigger Conditions (JSON)**: Large textarea with live validator. Displays a green checkmark or red warning banner based on `JSON.parse` validity.
  * **Response Options (JSON)**: Textarea with live validator. Includes a "Load Example Template" helper button to prefill structured choices to prevent manual syntax mistakes.
* **Actions**:
  * Saves via `createTemplate` or `updateTemplate` mutations.
  * Automatically refetches templates query on success.

### 4. Active Issues Monitor View
* **API Fetching**:
  * We will add an endpoint in `engine.ts` or query `Prisma` via a new endpoint `getActiveIssues` or similar. Wait, is there a way to view active issues currently? No, there is only `getRecentWorldIssues` (which is randomized for the splash feed).
  * Let's add a robust `getActiveIssues` admin procedure to `engine.ts` with filtering:
    * `status` (pending | responded | auto_resolved | expired)
    * `countryId` (filter by country)
    * `limit`, `cursor` for cursor pagination.
  * Renders:
    * Table/list showing Country Name, Title, Severity, Urgency, Status (with color-coded badges matching the Facet design system), Chosen Option, and Created/Responded timestamps.

---

## Verification Plan

### Automated Tests
* Run `bun run typecheck` or individual `bun run typecheck:server` / `bun run typecheck:ui` to ensure TypeScript compliance.
* Check router validation using AST verification helper if available, or manual procedure call.

### Manual Verification
* Navigate to the updated `/admin/national-issues` panel.
* Verify the Left Column (Engine Stats, Evaluate Engine, Seed Default Templates, Force Gen, Inject Event) remains fixed and sticky when the Templates list is scrolled.
* Toggle between "Templates Manager" and "Active Issues Monitor" views.
* Trigger "Seed Default Templates" and check that default templates are upserted.
* Create a new template with JSON validation checks, update it, and delete it.
* Preview a template against a selected country.
