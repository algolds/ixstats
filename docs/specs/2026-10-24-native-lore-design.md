# Native lore as WikiOS pages

Date: 2026-10-24 · Owner decisions gathered in conversation on 2026-10-24 · Follows `2026-10-24-country-page-passport-design.md` (the country page's Lore tab).

## Intent

A country's owner should have an easy way to write more lore than the single wiki article holds (people, places, events, organisations) without learning wikitext, and that lore must be WikiOS-friendly: it **is** wiki content, not a side store. Today's "native lore" is notes saved in each visitor's own browser (`useNativeLore`, localStorage) that any visitor can edit and nobody else can see; it is replaced entirely.

## Goals

- Native lore pieces are real WikiOS pages (wikitext, history, talk, mirrored to classic MediaWiki like any page).
- Writing one is a short guided flow from the country page, by the owner or an invited co-author.
- The Lore tab shows them as chapters beside the wiki article's chapters, read inline.

## Non-goals

- Dated lore does not feed the History tab.
- No generated text (no AI writing). Aids are plain: title checks, link suggestions, word count.
- No special edit protection on the wiki: these are normal pages anyone can edit there.
- No change to how WikiOS renders or stores pages.

## Anti-goals

- A second lore store that can drift from the wiki.
- Lore visible only on the device that wrote it (today's behaviour).
- A writing flow that drops the writer into raw wikitext.

## Pages

- **Titles:** ordinary article titles ("Constantinus I", "Senate of Caphiria"), checked against existing pages before creation (the WikiOS create flow's title step), never forced subpages.
- **Categories:** every piece carries `[[Category:<Country> lore]]` (new; no such category exists on ixwiki today) plus the country's existing `[[Category:<Country>]]`, so it also sits with the country's other wiki pages. The type grouping on the Lore tab comes from the piece's infobox type (stored with the curation record when created from the Lore tab, else inferred from the infobox), not from existing type categories such as "People of X", which would pull in their current members.
- **Infobox:** generated from the type's form using existing ixwiki templates (Template namespace is admin-only, so no new templates): Person → `Infobox person` (or officeholder), Place → `Infobox settlement`, Event → `Infobox event` (or `Infobox military conflict` for wars; `Infobox historical event` does not exist on ixwiki, and the existing WikiOS "history" create type that uses it should switch to `Infobox event` too), Organisation → `Infobox organization` (or `Infobox company` / `Infobox political party`). Verify each template exists on ixwiki before relying on it.
- **Wiki edits:** open to any editor, like every wiki page.

## Writing flow

1. **Entry points** (owner and co-authors only): "Write lore" on the Lore tab; "Write about this place" on a city, region or story pin in the Map tab (prefills title, type Place and the location); "Write about this event" on a History entry (prefills title, type Event and the date).
2. **Type and form:** pick Person, Place, Event or Organisation; a short form fills the infobox fields. Reuse the WikiOS create-page flow (`src/components/wiki-os/shared/CreatePageModal.tsx`, `create-page/TypeStep`, `TitleStep`, `MetadataStep`, `WikitextTemplates.ts`), extending its types with Place (settlement) and a general Organisation, and adding the country lore categories automatically.
3. **Body:** the body opens in the WikiOS visual editor (`WikiVisualEditor`) with the generated infobox and section headings for the type already in place.
4. **Aids:** the title check, suggestions to link existing wiki pages while writing, and a word count. Nothing generated.
5. **Save:** through WikiOS's normal save path with the writer's own identity (their edit appears in page history under them).

## Lore tab

- The Lore tab lists pages carrying `Category:<Country> lore` **plus any existing page the owner adds by title** (a curation record pointing at the title; no wiki edit), and shows each as a chapter in the chapter index, mixed with the wiki article's chapters and grouped by type (People, Places, Events, Organisations). Existing pages under `Category:<Country>` (Caphiria has 256) are not listed unless added this way.
- Choosing one renders it inline in the reading column with the WikiOS reader, with "Open in WikiOS" and (for owner and co-authors) "Edit" beside its heading.
- **Owner curation:** the owner can pin pieces (shown first in their group), hide pieces, and add existing pages by title, all without touching the wiki. This needs a small IxStats record per country and page (title, pinned, hidden, type, order).
- Pages written directly in WikiOS that carry the category appear automatically.

## Co-authors

- The owner manages a lore team on the hero's back face (the Manage flip): add or remove co-authors by IxnayID.
- Co-authors get the entry points and the Edit action on the country page; on the wiki they are ordinary editors.
- Stored in IxStats per country.

## Data

- WikiOS editing is live in production (owner, 2026-10-24; `docs/systems/SYSTEM_STATUS.md` still says it is off and should be corrected). The entry points and Edit still respect WikiOS's own editing switch (`WIKIOS_V1_ENABLED` and `src/lib/wiki-os/editing-switch.ts`), hiding themselves when it is off, so the feature never offers a save that would be refused.
- New IxStats records: country lore authors (country, user, added by, added at) and lore page curation (country, page title, pinned or hidden, order). Production schema change: per CLAUDE.md, `db:push`/`db:migrate` are blocked; the plan ships SQL for the owner to apply (the repo's deploy runbook pattern), never runs it against production.
- Reads: the category listing through WikiOS (its `api.php`/search routers); page bodies through the WikiOS reader.
- Writes: page creation and edits only through WikiOS's existing save path.

## Realms

- Native lore is for countries in the default (IxWiki) realm only: the entry points, the team and the curation endpoints check the country's realm server-side. Other realms' Lore tabs read their own wiki as today, without native lore. (Country names are only unique within a realm, and WikiOS writes only to ixwiki.)

## Constraints

- Facet rules as in the country-page design; sentence case; no AI-design tells.
- The repo is public: no credentials or operational history in docs or PR text.
- Server-side permission checks: only the owner manages the team and curation; only owner and co-authors see the entry points (the wiki itself stays open).

## Left to the builder

- Template field mapping per type, and how the title check reports a clash.
- Where the curation and team records live in the Prisma schema files.
- The visual editor's mounting inside the country page (sheet or full-screen overlay) as long as the writer never leaves the country page until they choose "Open in WikiOS".
