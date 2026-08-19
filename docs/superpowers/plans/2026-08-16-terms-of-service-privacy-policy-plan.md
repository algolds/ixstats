# Implementation Plan — IxStates Terms of Service & Privacy Policy

Provide official, accessible, and legally sound Terms of Service and Privacy Policy documentation for IxStates with dedicated responsive Next.js pages, sticky interactive table of contents, "Plain English Summary" callouts, and integration with platform navigation touchpoints.

## User Review Required

> [!NOTE]
> All core architectural decisions were finalized during brainstorming:
> - **Platform Model**: Community / Hobbyist Creative Platform operated by the Ixnay Community / IxWiki administration under US jurisdiction.
> - **Minimum Age**: Strict 16+ across all regions.
> - **Dual-Layer Licensing**: Creators retain full copyright over original imported lore/art; IxStates secures an exclusive/perpetual platform operating license for platform-transformed assets (Onoma conlangs, Vexel heraldry, simulation models) that survives account deletion for world continuity; public lore defaults to CC-BY-SA 4.0.
> - **Account Deletion / Privacy**: Full PII erasure with simulation continuity (national entities anonymized/archived).

---

## Proposed Changes

### Legal Document Layout & Components

#### [NEW] [LegalDocumentLayout.tsx](file:///home/jxsig/projects/ixstats/src/components/legal/LegalDocumentLayout.tsx)
- Create a shared, responsive layout wrapper for legal documents:
  - Header with IxStates emblem, document title, version tag (`v1.0 "Ogma"`), and last updated date (`August 2026`).
  - Interactive sticky sidebar table-of-contents with active-scroll highlight and mobile dropdown/sheet support.
  - Print button & direct download utility.
  - Facet glass styling with subtle refraction overlays and typography hierarchy.

---

### App Router Legal Pages

#### [NEW] [src/app/terms/page.tsx](file:///home/jxsig/projects/ixstats/src/app/terms/page.tsx)
- Create `/terms` route rendering the full Terms of Service:
  - Section 1: **Acceptance & Age 16+ Requirement**
  - Section 2: **Dual-Layer UGC & Intellectual Property Model** (Creator-owned original lore vs. perpetual license on platform-transformed assets + CC-BY-SA 4.0 for shared lore + DMCA safe-harbor notice/counter-notice procedure)
  - Section 3: **Acceptable Use & Conduct** (Fictional in-character geopolitical roleplay vs. out-of-character harassment/hate speech/doxxing/CSAM + anti-abuse/scraping)
  - Section 4: **Third-Party Disclaimers & Integrations** (NationStates API disclaimer & compliance, Clerk, Discord, XenForo, MediaWiki)
  - Section 5: **Virtual Assets & Simulation Disclaimers** (No real-world monetary value, balance rebalancing, "As-Is" warranty disclaimer, limitation of liability)
  - Section 6: **Termination, Governing Law & Contact (`legal@ixwiki.com`)**
  - Side-by-side / inline **"Plain English Summary"** cards for each section.

#### [NEW] [src/app/privacy/page.tsx](file:///home/jxsig/projects/ixstats/src/app/privacy/page.tsx)
- Create `/privacy` route rendering the full Privacy Policy:
  - Section 1: **Information Collected** (Clerk user ID, email, linked Discord/Wiki/Forum IDs, in-game stats, UGC, IP/security logs)
  - Section 2: **How We Use Information & Zero-Sale Commitment** (Authentication, game simulation, security, zero selling or renting of personal data)
  - Section 3: **Subprocessors & Data Storage** (Clerk, self-hosted Docker PostgreSQL/PostGIS/Redis)
  - Section 4: **Cookies & Local Storage** (Strictly essential functional session tokens)
  - Section 5: **User Rights, Erasure & Simulation Continuity** (GDPR/CCPA access/export, PII purge, anonymized/archived nation state for unbroken world history)
  - Section 6: **Security Safeguards, International Transfers & Privacy Contact (`privacy@ixwiki.com`)**
  - Visual summary badges for key privacy guarantees.

---

### Navigation & Application Touchpoints

#### [MODIFY] [SplashFold.tsx](file:///home/jxsig/projects/ixstats/src/app/_components/splash/SplashFold.tsx)
- Add a refined, minimal legal footer row to the public splash page with links to `/terms`, `/privacy`, Discord, and WikiOS.

#### [MODIFY] [WikiOSLayout.tsx](file:///home/jxsig/projects/ixstats/src/components/wiki-os/shared/WikiOSLayout.tsx)
- Update the WikiOS footer (`<footer className="wikios-main-footer ...">`) to include links to `Terms of Service` and `Privacy Policy`.

#### [MODIFY] [PrivacySecurityCard.tsx](file:///home/jxsig/projects/ixstats/src/app/settings/_components/PrivacySecurityCard.tsx)
- Add a "Legal & Data Rights" section inside the settings privacy card linking directly to `/terms` and `/privacy`, highlighting the user's right of erasure and data export.

#### [MODIFY] [src/app/sign-up/[[...rest]]/page.tsx](file:///home/jxsig/projects/ixstats/src/app/sign-up/%5B%5B...rest%5D%5D/page.tsx)
- Add a clean legal notice below the sign-up container: *"By registering, you agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy) (Minimum Age 16+)."*

---

## Verification Plan

### Automated Verification
- Sub-project UI typecheck to ensure all components, routes, and link props are strictly type-safe:
  ```bash
  bun run typecheck:ui
  ```
- Verify ESLint and formatting:
  ```bash
  bun run lint
  ```

### Manual Verification
- Navigate to `http://localhost:3000/terms` and verify sticky table-of-contents scrolling, section anchors, and summary callouts.
- Navigate to `http://localhost:3000/privacy` and verify data rights layout and typography.
- Verify footer links in Splash (`/`), WikiOS (`/wiki/`), Settings (`/settings`), and Sign-Up (`/sign-up`).
- Test responsiveness across mobile (<640px), tablet (768px-1024px), and desktop viewports.
