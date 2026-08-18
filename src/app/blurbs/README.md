# Blurbs

**Last updated:** June 2026

Blurbs is the platform's "Topic Tuesday" community prompt system. Admins (or users, pending review) publish **prompts** — open-ended questions about a nation's culture, daily life, history, or lore — and signed-in users post a single **response** per prompt from their country's perspective. Responses can link wiki articles and may be flagged "featured" by admins. The system lives inside the WikiOS shell (`WikiOSLayout`) and writes/reads via the `blurbs` tRPC router.

> **Discrepancy with root README:** the root `README.md` (line 182) calls Blurbs "community wiki reviews." The code does **not** implement article reviews — it implements weekly cultural prompts and per-country responses (an in-house "Topic Tuesday"). Wiki articles only appear as optional links attached to a response (`linkedArticles`, max 5). The root description is inaccurate; this README reflects the code.

## Routes

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/blurbs` | `page.tsx` | Public | Browse active prompts (`BlurbPromptList`) |
| `/blurbs/[slug]` | `[slug]/page.tsx` | Public (submit requires sign-in) | Single prompt, its responses, and submission form |
| `/blurbs/mine` | `mine/page.tsx` | Signed-in | Current user's own responses across all prompts |
| `/blurbs/submit` | `submit/page.tsx` | Signed-in | Suggest a new prompt (saved as `DRAFT` for admin review) |

Admin moderation is **not** under `/blurbs` — it lives at `src/app/admin/blurbs/BlurbsPanel.tsx`.

## Key features

- **Prompts** with lifecycle status: `DRAFT → ACTIVE → CLOSED → ARCHIVED`; optional `scheduledFor`, `closedAt`, `isRecurring`, `featured`.
- **One response per user per prompt** (DB `@@unique([promptId, userId])`); requires the user to have a country.
- **Response content** up to 1000 chars; optional `linkedArticles` (title + url, max 5; URL defaults to `/wiki/<Title>`).
- **24-hour edit window** on a user's own response (`updateResponse`).
- **Featured flags** on both prompts and responses, set by admins; featured responses sort first.
- **Auto cross-post to ThinkPages**: on submit, if the user has a ThinkPages account, a public auto-generated post (≤280 chars, `#blurb #topictuesday`, `[blurb:slug|title]` prefix) is created and its id stored in `thinkpagesPostId`. Non-fatal if it fails.
- **User-submitted prompts** are auto-slugged and saved as `DRAFT`; an admin must publish.

## Architecture

| Component / file | Role |
|------------------|------|
| `src/app/blurbs/*` | 4 page shells, all wrapped in `WikiOSLayout` |
| `src/components/thinkpages/blurbs/BlurbPromptList.tsx` | Active-prompt browse list |
| `src/components/thinkpages/blurbs/BlurbPromptDetail.tsx` | Prompt header, responses list, internal `BlurbSubmissionForm` (content + wiki-article linker) |
| `src/components/thinkpages/blurbs/BlurbsNav.tsx` | Browse / My Blurbs / Submit nav (basePath-aware) |
| `src/app/admin/blurbs/BlurbsPanel.tsx` | Admin moderation UI |
| `components/dashboard/sections/BlurbSection.tsx` | Dashboard surface |
| `components/wiki-os/reader/WikiOSMainPage.tsx`, `InfoboxWithMap.tsx`, `categories/CountryPortal.tsx` | WikiOS surfaces (homepage prompt, country blurbs) |

State is plain tRPC React Query (infinite queries with cursor pagination); no dedicated hooks directory.

## Data model

Two Prisma models in `prisma/schema/wiki.prisma`: `BlurbPrompt` (`blurb_prompts`) and `BlurbResponse` (`blurb_responses`, FK to prompt / `User` / `Country`). Status enum `BlurbPromptStatus`.

## tRPC API — `api.blurbs.*`

Router: `src/server/api/routers/blurbs/` (`mergeRouters` of three files; registered in `root.ts` as `blurbs`).

| Procedure | File | Access | Notes |
|-----------|------|--------|-------|
| `getActivePrompts` | `browse.ts` | public | Active prompts, newest first, cursor-paginated |
| `getPrompt` | `browse.ts` | public | By slug, with response count |
| `getResponsesForPrompt` | `browse.ts` | public | Paginated, featured-first option |
| `getResponsesForCountry` | `browse.ts` | public | All blurbs for a country |
| `getBlurbCount` | `browse.ts` | public | Total response count (WikiOS stat card) |
| `getRandomActivePrompt` | `browse.ts` | public | Random/featured prompt for WikiOS homepage |
| `getMyBlurbs` | `respond.ts` | protected | Current user's responses |
| `getMyResponse` | `respond.ts` | protected | Whether user already answered a prompt |
| `submitResponse` | `respond.ts` | protected | Create response (+ThinkPages cross-post) |
| `updateResponse` | `respond.ts` | protected | Edit own response within 24h |
| `submitPrompt` | `respond.ts` | protected | Suggest a prompt (→ `DRAFT`) |
| `getAllPrompts` | `moderate.ts` | admin | All prompts incl. drafts/closed/archived |
| `createPrompt` / `updatePrompt` | `moderate.ts` | admin | Prompt lifecycle management |
| `featureResponse` / `featurePrompt` | `moderate.ts` | admin | Toggle featured flags |

## Connections

- **WikiOS** — Blurbs render inside `WikiOSLayout`; prompts/counts surface on the WikiOS homepage and country portals.
- **ThinkPages** — responses auto-cross-post (see above) when the user has a ThinkPages account.
- **Wiki articles** — responses may link `/wiki/<Title>` articles; country names also link to their wiki pages.
- **Countries / Clerk users** — every response is tied to a `Country` and a `User`; submitting requires a country.
