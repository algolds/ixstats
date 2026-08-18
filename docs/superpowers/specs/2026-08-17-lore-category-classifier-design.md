# Design Specification: MediaWiki Lore Article Classifier & Cataloging Engine

**Date:** 2026-08-17  
**Status:** In Review  
**Audience:** Antigravity / Engineers  
**Methodologies:** `brainstorming`, `grill-me`, `typescript-pro`, `ponytail`

---

## 1. Executive Summary

This specification outlines the architecture and implementation of an intelligent, multi-signal **Lore Article Classifier and Cataloging Engine** for IxStates.

### Problem Statement
1. **Schema Mismatch**: The generator in `src/lib/wiki-lore-card-generator.ts` was outputting legacy string categories (`"Historical Figures"`, `"Locations"`, `"Artifacts"`, `"Events"`) instead of the 12 canonical `LoreCategory` enum values (`PEOPLE`, `GEOGRAPHY`, `MILITARY`, `GOVERNMENT`, `DIPLOMACY`, `CULTURE`, `RELIGION`, `ECONOMY`, `SCIENCE`, `HISTORY`, `NATION`, `SPECIAL`).
2. **Naive Keyword Matching**: Classification was relying on crude substring searches (e.g. `catTitle.includes("cit")` which matched "cite" and "implicit"), producing miscategorized cards that defaulted to `"NATION"`.
3. **Unclassified Legacy Cards**: Existing database records contain unclassified or misclassified lore cards with missing top-level `category` values.

### Objectives
1. Build a high-precision **Multi-Signal Classifier** leveraging **MediaWiki Infobox templates**, **Category hierarchy taxonomy**, and **Synonym weight scoring**.
2. Standardize all card generation and discovery pipelines to output strictly typed `LoreCategory` values.
3. Build an **Admin Batch Re-Classifier & Auto-Sync Mutation/UI** in `/admin/cards` to re-catalog and persist accurate categories across all database records.
4. Implement a robust **Runtime Fallback Classifier** so unmigrated cards render with accurate visual category identities immediately.

---

## 2. Classifier Architecture: Multi-Signal Scoring Engine

The classifier calculates a weighted score per category across four signal tiers:

```
┌────────────────────────────────────────────────────────────┐
│                    Wiki Article Input                      │
│   (Wikitext, Infoboxes, Categories, Title, Lead Summary)   │
└─────────────────────────────┬──────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Tier 1:    │       │   Tier 2:    │       │   Tier 3:    │
│ Infobox Map  │       │ Category Tree│       │  Synonyms &  │
│  (50 Points) │       │ (10 Pts each)│       │ Lead Scoring │
│              │       │              │       │ (1-15 Points)│
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              ▼
               ┌──────────────────────────────┐
               │  Weighted Category Resolver  │
               │   & Specificity Arbiter      │
               └──────────────┬───────────────┘
                              ▼
                Validated LoreCategory Enum
```

### Signal Tiers & Weights

| Tier | Signal Source | Weight | Description |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Infobox Template** | **50 points** | High-signal MediaWiki template regex (e.g. `{{Infobox person}}` $\to$ `PEOPLE`, `{{Infobox military conflict}}` $\to$ `MILITARY`, `{{Infobox settlement}}` $\to$ `GEOGRAPHY`, `{{Infobox treaty}}` $\to$ `DIPLOMACY`). |
| **Tier 2** | **Category Taxonomy** | **10 points** per category | Matches against known MediaWiki parent category patterns and prefix trees (`Category:Rivers of...`, `Category:Presidents of...`, `Category:Battles involving...`). |
| **Tier 3** | **Synonym / Lead NLP** | **1 point** per term (max 15) | Matches against the 600+ domain keywords in `CATEGORY_SYNONYMS` across the article title, first 3 paragraphs, and excerpt. |

### Tie-Breaking & Domain Specificity Matrix
When scores are tied, more specific domains take precedence over broader ones:
`DIPLOMACY` / `MILITARY` / `PEOPLE` / `RELIGION` / `SCIENCE` / `ECONOMY` $\succ$ `GOVERNMENT` / `CULTURE` $\succ$ `GEOGRAPHY` / `HISTORY` $\succ$ `NATION` $\succ$ `SPECIAL`.

---

## 3. Infobox & Category Taxonomy Mapping

```typescript
export const INFOBOX_CATEGORY_MAP: Record<string, LoreCategory> = {
  // PEOPLE
  "infobox person": LoreCategory.PEOPLE,
  "infobox officeholder": LoreCategory.PEOPLE,
  "infobox politician": LoreCategory.PEOPLE,
  "infobox monarch": LoreCategory.PEOPLE,
  "infobox prime minister": LoreCategory.PEOPLE,
  "infobox president": LoreCategory.PEOPLE,
  "infobox leader": LoreCategory.PEOPLE,
  "infobox military person": LoreCategory.PEOPLE,
  "infobox royalty": LoreCategory.PEOPLE,
  "infobox noble": LoreCategory.PEOPLE,
  "infobox biography": LoreCategory.PEOPLE,
  "infobox artist": LoreCategory.PEOPLE,
  "infobox writer": LoreCategory.PEOPLE,
  "infobox scientist": LoreCategory.PEOPLE,

  // MILITARY
  "infobox military conflict": LoreCategory.MILITARY,
  "infobox war": LoreCategory.MILITARY,
  "infobox battle": LoreCategory.MILITARY,
  "infobox military unit": LoreCategory.MILITARY,
  "infobox weapon": LoreCategory.MILITARY,
  "infobox armed forces": LoreCategory.MILITARY,
  "infobox military installation": LoreCategory.MILITARY,
  "infobox military vehicle": LoreCategory.MILITARY,
  "infobox ship": LoreCategory.MILITARY,

  // DIPLOMACY
  "infobox treaty": LoreCategory.DIPLOMACY,
  "infobox bilateral relations": LoreCategory.DIPLOMACY,
  "infobox diplomatic mission": LoreCategory.DIPLOMACY,
  "infobox international organization": LoreCategory.DIPLOMACY,
  "infobox summit": LoreCategory.DIPLOMACY,

  // GEOGRAPHY
  "infobox settlement": LoreCategory.GEOGRAPHY,
  "infobox city": LoreCategory.GEOGRAPHY,
  "infobox town": LoreCategory.GEOGRAPHY,
  "infobox village": LoreCategory.GEOGRAPHY,
  "infobox river": LoreCategory.GEOGRAPHY,
  "infobox lake": LoreCategory.GEOGRAPHY,
  "infobox mountain": LoreCategory.GEOGRAPHY,
  "infobox mountain range": LoreCategory.GEOGRAPHY,
  "infobox island": LoreCategory.GEOGRAPHY,
  "infobox sea": LoreCategory.GEOGRAPHY,
  "infobox ocean": LoreCategory.GEOGRAPHY,
  "infobox valley": LoreCategory.GEOGRAPHY,
  "infobox desert": LoreCategory.GEOGRAPHY,
  "infobox landform": LoreCategory.GEOGRAPHY,
  "infobox protected area": LoreCategory.GEOGRAPHY,

  // RELIGION
  "infobox religious building": LoreCategory.RELIGION,
  "infobox church": LoreCategory.RELIGION,
  "infobox temple": LoreCategory.RELIGION,
  "infobox mosque": LoreCategory.RELIGION,
  "infobox deity": LoreCategory.RELIGION,
  "infobox religion": LoreCategory.RELIGION,
  "infobox religious order": LoreCategory.RELIGION,

  // GOVERNMENT
  "infobox government agency": LoreCategory.GOVERNMENT,
  "infobox legislature": LoreCategory.GOVERNMENT,
  "infobox parliament": LoreCategory.GOVERNMENT,
  "infobox ministry": LoreCategory.GOVERNMENT,
  "infobox court": LoreCategory.GOVERNMENT,
  "infobox supreme court": LoreCategory.GOVERNMENT,
  "infobox election": LoreCategory.GOVERNMENT,
  "infobox political party": LoreCategory.GOVERNMENT,
  "infobox constitution": LoreCategory.GOVERNMENT,

  // ECONOMY
  "infobox company": LoreCategory.ECONOMY,
  "infobox corporation": LoreCategory.ECONOMY,
  "infobox bank": LoreCategory.ECONOMY,
  "infobox central bank": LoreCategory.ECONOMY,
  "infobox currency": LoreCategory.ECONOMY,
  "infobox stock exchange": LoreCategory.ECONOMY,

  // SCIENCE
  "infobox technology": LoreCategory.SCIENCE,
  "infobox railway": LoreCategory.SCIENCE,
  "infobox aircraft": LoreCategory.SCIENCE,
  "infobox spacecraft": LoreCategory.SCIENCE,
  "infobox observatory": LoreCategory.SCIENCE,
  "infobox laboratory": LoreCategory.SCIENCE,
  "infobox university": LoreCategory.SCIENCE,

  // CULTURE
  "infobox monument": LoreCategory.CULTURE,
  "infobox building": LoreCategory.CULTURE,
  "infobox museum": LoreCategory.CULTURE,
  "infobox artwork": LoreCategory.CULTURE,
  "infobox festival": LoreCategory.CULTURE,
  "infobox national symbol": LoreCategory.CULTURE,

  // HISTORY
  "infobox historical event": LoreCategory.HISTORY,
  "infobox historical era": LoreCategory.HISTORY,
  "infobox revolution": LoreCategory.HISTORY,
  "infobox crisis": LoreCategory.HISTORY,
  "infobox timeline": LoreCategory.HISTORY,

  // NATION
  "infobox country": LoreCategory.NATION,
  "infobox nation": LoreCategory.NATION,
  "infobox former country": LoreCategory.NATION,
  "infobox sovereign state": LoreCategory.NATION,
  "infobox state": LoreCategory.NATION,

  // SPECIAL
  "infobox artifact": LoreCategory.SPECIAL,
  "infobox relic": LoreCategory.SPECIAL,
  "infobox wonder": LoreCategory.SPECIAL,
};
```

---

## 4. Admin Batch Re-Classifier & Auto-Sync Tool

Add a dedicated procedure and modal in the Admin Batch interface:

### Backend tRPC Mutation (`api.loreCards.reclassifyLoreCards`)
- Inputs: `wikiSource: "ixwiki" | "iiwiki" | "all"`, `limit: number`, `forceOverwrite: boolean`.
- Scans `card` rows where `cardType IN ('LORE', 'LORE_BATCH')` or `wikiArticleTitle IS NOT NULL`.
- Re-runs the classifier on article wikitext and MediaWiki categories.
- Updates `card.category` and `metadata.category` with the canonical `LoreCategory`.
- Returns summary statistics: `{ totalProcessed, reclassifiedCount, distributionByLoreCategory }`.

### Frontend Admin UI Component (`LoreCardBatchAdmin.tsx`)
- Action Button: `"Re-Catalog Categories"` in the toolbar.
- Progress dialog displaying real-time batch re-classification with breakdown badges.

---

## 5. Verification Plan

1. **Unit & Logic Testing**:
   - Verify that articles with `{{Infobox settlement}}` classify to `GEOGRAPHY`.
   - Verify that articles with `{{Infobox military conflict}}` classify to `MILITARY`.
   - Verify that articles with `{{Infobox officeholder}}` classify to `PEOPLE`.
   - Verify that articles with `{{Infobox treaty}}` classify to `DIPLOMACY`.
2. **Schema & Backwards Compatibility**:
   - Ensure all output strings strictly adhere to `LoreCategory`.
   - Ensure `CardDisplay.tsx`, `CardDetailsModal.tsx`, `CardLoreTab.tsx`, and `CardOverviewTab.tsx` resolve without fallback regressions.
3. **Lint & Typecheck**:
   - Run `bunx eslint` across all modified files (0 errors, 0 warnings).
