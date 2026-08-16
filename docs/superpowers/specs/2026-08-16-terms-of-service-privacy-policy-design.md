# IxStates Terms of Service & Privacy Policy Design Spec

**Date**: 2026-08-16  
**Status**: Draft (Approved in Brainstorming)  
**Target Release**: IxStates 1.1.1 "Ogma" (or next minor)  
**Authors**: Antigravity & IxStates Core Administration  

---

## 1. Overview & Objectives

IxStates (dev codename *IxStats*, web domain `ixwiki.com/projects/ixstats`) is a rich nation-simulation, geofiction, and conworlding platform featuring national management (MyCountry), procedural and GIS mapping (IxWorld / Realms), persona social feeds (ThinkPages), collectible card trading (IxVault), direct messaging (ThinkShare), linguistics engines (Onoma), heraldry tools (Vexel), and wiki knowledge integration (WikiOS).

As the platform matures and hosts external players across multiple realms, it requires an official, legally sound, and accessible **Terms of Service (ToS)** and **Privacy Policy**.

### Key Goals
1. **Clear Legal Protections**: Provide robust liability limitations, DMCA safe harbor procedures, acceptable use rules, and clear age requirements (16+ worldwide).
2. **Dual-Layer Intellectual Property Model**:
   - Protect creator ownership of their original imported lore, characters, and artwork.
   - Secure a non-exclusive, royalty-free, worldwide license for IxStates on all platform-transformed/generated assets (e.g. Onoma conlang dictionaries, Vexel blazons, map vector meshes, simulation metrics) that persists for world continuity.
3. **Transparent Privacy & Data Continuity**: Complete GDPR/CCPA compliant privacy disclosures with an anonymized archiving model for national simulation continuity upon account erasure.
4. **First-Class UI/UX Experience**: Provide dedicated, beautifully styled `/terms` and `/privacy` pages built in Next.js with Facet design tokens, sticky table of contents navigation, and "Plain English Summary" sidebars/callouts alongside formal legal text.

---

## 2. Legal Entity & Platform Framework

| Property | Definition |
| :--- | :--- |
| **Platform Name** | IxStates (also encompassing IxStats, IxWorld, Realms, ThinkPages, IxVault, Onoma, Vexel, WikiOS) |
| **Operating Entity** | Ixnay Community / IxWiki Administration (Non-commercial hobbyist & creative digital platform) |
| **Governing Jurisdiction** | United States (with global privacy compliance for GDPR/CCPA) |
| **Minimum Age** | **16+ worldwide** (Uniform baseline ensuring compliance with EU GDPR child consent rules and US COPPA standards) |
| **Official Contact** | `admin@ixwiki.com` / `legal@ixwiki.com` |
| **Default Lore License** | Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0) for public lore |

---

## 3. Terms of Service (ToS) Specification

The Terms of Service document will be structured into distinct sections:

### Section 1: Acceptance & Eligibility
* **Binding Agreement**: Accessing, registering, or using IxStates constitutes acceptance of the Terms of Service.
* **Age Requirement**: Users must be at least 16 years of age. Accounts found to be operated by individuals under 16 will be terminated immediately.
* **Account Responsibility**: Users are responsible for maintaining the confidentiality of their credentials (managed via Clerk authentication). Users may control multiple in-game nations or personas, but automated multi-accounting for fraudulent simulation advantage or market manipulation is prohibited.

### Section 2: Intellectual Property & Content Licensing (Dual-Layer Model)
* **Creator-Owned IP (Pre-existing & Original Lore)**:
  * Users retain 100% copyright and intellectual property ownership over their original written worldbuilding, characters, storylines, custom flag illustrations, and external creative works brought into IxStates.
* **Platform-Transformed & Generative Engine Assets (Onoma, Vexel, Sim Data)**:
  * When users generate, compute, or transform content using IxStates engines (such as Onoma phonetic rules/lexicons, Vexel heraldic blazons, map vector meshes, economic policies, or executive directives), **IxStates retains a perpetual, irrevocable, non-exclusive, royalty-free, worldwide license** to host, display, compute, reproduce, analyze, and retain those transformed assets within the platform.
  * This license survives account termination, data deletion, or nation relinquishment to preserve historical simulation integrity.
* **Community Commons for Public Lore**:
  * All public wiki articles, shared timeline events, and open-lore contributions default to **CC-BY-SA 4.0**, permitting the community to reference and build upon shared historical records with appropriate attribution.
* **DMCA & Copyright Takedown Policy**:
  * Clear procedure for copyright owners to submit takedown notices regarding uploaded flag images, custom card graphics, or text infringing third-party rights.
  * Designated DMCA email contact and statutory counter-notice timeline.

### Section 3: Acceptable Use & Conduct (Fictional Roleplay vs. Real-World Conduct)
* **Fictional Roleplay & In-Character (IC) Expression**:
  * IxStates is a geopolitical simulation and creative writing sandbox. Depictions of fictional authoritarianism, fictional conflicts, political debates, diplomatic posturing, economic rivalries, and dystopian storytelling are permitted **in-character** within appropriate creative boundaries.
* **Out-of-Character (OOC) Strict Prohibitions**:
  * Real-world hate speech, bigotry, racism, harassment, threats of real-world violence, stalking, doxxing (publishing personal real-world information), non-consensual sexual content, and child sexual abuse material (CSAM) are strictly forbidden with zero tolerance.
  * Impersonation of real-world living persons or real-world political entities in bad faith.
* **System Integrity & Technical Abuse**:
  * Prohibition of unauthorized automated scraping, denial of service (DoS), botting simulation actions outside approved APIs, attempting to bypass rate limits, or exploiting database vulnerabilities.
* **Moderation & Administrative Action**:
  * The administration reserves the right to issue warnings, mute accounts, freeze or archive nations, reset exploited stats, or permanently ban accounts via Clerk.

### Section 4: Third-Party Services & Independent Status
* **NationStates API Disclaimer**:
  * IxStates is an independent, non-commercial community project and is **not affiliated with, endorsed by, or sponsored by NationStates or NationStates LLC**.
  * Card imports, verification codes, and flag proxy features operate under the NationStates API Terms of Use (enforcing 800ms request spacing, transparent User-Agent headers, and card takedown compliance).
* **Clerk, Discord & External Platforms**:
  * Authentication and external linking (Discord OAuth, XenForo forum sync, MediaWiki/IxnayID) are subject to the respective third-party service agreements.

### Section 5: Virtual Assets, Simulation Adjustments & Disclaimers
* **No Real-World Monetary Value**:
  * In-game currencies, credits, card valuations, deck values, trade offers, and market shares are purely fictional game mechanics with **zero real-world monetary value**. Virtual assets cannot be exchanged for real fiat currency.
* **Simulation Adjustments**:
  * Game balance, economic formulas, engine algorithms, and feature sets may be updated, rebalanced, or patched at any time without liability.
* **Warranty Disclaimer & Limitation of Liability**:
  * The service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of uninterrupted uptime. Under no circumstances will administrators be liable for indirect or consequential damages.

---

## 4. Privacy Policy Specification

The Privacy Policy will clearly communicate what information is collected, how it is handled, and user privacy rights:

### Section 1: Information We Collect
1. **Account & Authentication Data**:
   * Clerk Authentication identifier (`clerkUserId`), verified email address, display username, account creation timestamp.
2. **Linked Account Identifiers**:
   * Discord user ID & username (via OAuth linking), MediaWiki account ID (`wikiUserId`), XenForo forum ID (`forumUserId`), verified NationStates nation name.
3. **In-Game Simulation & Creative Content**:
   * User-submitted nation parameters, budget allocations, atomic government components, ThinkPages posts/blurbs, personas, direct messages (ThinkShare), card trade offers, and Onoma conlang entries.
4. **Technical & Telemetry Data**:
   * IP addresses (stored in temporary server access logs, Redis rate limiters, and PostgreSQL security audit logs for brute-force defense and DDoS mitigation), browser user-agent, session tokens.

### Section 2: How We Use Information
* To authenticate user identity and maintain secure sessions.
* To execute the real-time game engine, compute national statistics, and facilitate player-to-player interactions (diplomacy, trading, social feeds).
* To protect platform security, enforce rate limits, and investigate malicious activity.
* **Zero Sale Policy**: We **never** sell, rent, monetize, or trade user personal information to data brokers or third-party advertisers.

### Section 3: Third-Party Service Providers & Subprocessors
* **Clerk Inc.** — Authentication, identity management, session tokens (US-hosted).
* **Infrastructure Hosting** — Self-hosted Docker PostgreSQL/PostGIS and Redis database instances managed on secured private servers.
* **NationStates API** — Verification and card deck sync (transmitting only player nation names and API requests conforming to NS guidelines).

### Section 4: Cookies & Local Browser Storage
* IxStates uses strictly functional and session cookies (e.g. Clerk authentication JWTs, active nation selector preference, dark/light theme state).
* No cross-site tracking cookies, ad network pixels, or third-party analytics trackers are used.

### Section 5: User Rights, Data Erasure & World Continuity
* **Access & Portability**: Users may request a summary of their stored account data and can export their custom creative dictionaries (Onoma) or nation summaries.
* **Right to Erasure (GDPR / CCPA)**:
  * Users can request permanent account deletion through settings or by contacting `privacy@ixwiki.com`.
  * **PII Purge**: All personally identifiable information (email, Clerk ID, password hashes, external Discord/Wiki connections, IP audit logs) is permanently deleted.
  * **Simulation Continuity (Anonymization)**: To prevent breaking the shared-world map topology, historical diplomatic treaties, trade ledgers, and wiki history, public nation records and platform-transformed assets are severed from the deleted user and marked as *Archived/Historic Non-Player Entities*.

---

## 5. UI / UX Architecture & Implementation Plan

### 5.1 New Dedicated Routes
* `src/app/terms/page.tsx`:
  * Responsive layout featuring a sticky sidebar with section anchors (Acceptance, IP & Licensing, Roleplay & Conduct, Third-Party, Disclaimers).
  * Styled with Facet design tokens: glassmorphism cards, glowing ambient borders, typography hierarchy (`Inter` / `Outfit`).
  * "Plain English Summary" callout pills alongside formal legal clauses.
* `src/app/privacy/page.tsx`:
  * Responsive layout featuring sticky sidebar with section anchors (Data Collected, How We Use Data, Subprocessors, Rights & Deletion, Cookies).
  * Highlighting data rights, GDPR/CCPA compliance, and zero-sale commitment.

### 5.2 Navigation & Touchpoint Integrations
1. **Public Splash Page**:
   * Add a minimal, elegant legal footer row in the homepage / splash view (`src/app/_components/splash/` or shared layout) with links to `Terms of Service`, `Privacy Policy`, and `Discord`.
2. **WikiOS Layout**:
   * Add `Terms` and `Privacy` links to the existing footer in `src/components/wiki-os/shared/WikiOSLayout.tsx`.
3. **Settings Page (Privacy & Security)**:
   * Update `src/app/settings/_components/PrivacySecurityCard.tsx` with direct navigation cards to `/terms` and `/privacy` along with data export/erasure guidelines.
4. **Sign-Up Flow**:
   * Update `src/app/sign-up/[[...rest]]/page.tsx` with a clean footnote: *"By signing up, you agree to the IxStates Terms of Service and Privacy Policy (Age 16+)."*
5. **MyCountry Compliance Modal**:
   * Ensure compliance dialogs (`src/components/mycountry/MyCountryComplianceModal.tsx`) link directly to `/terms` and `/privacy`.

---

## 6. Verification & Quality Gates

* **Build & Typecheck**: Safe sub-project typecheck (`bun run typecheck:ui`) to ensure all route and component imports compile cleanly.
* **Visual & Accessibility Review**:
  * Verify dark/light mode legibility on desktop and mobile viewports.
  * Verify anchor jump links scroll smoothly with header offset.
  * Verify screen-reader accessibility and semantic HTML hierarchy (`<h1>`, `<section>`, `<h2>`, `<nav>`).
* **Responsive Layouts**: Confirm tablet and mobile views collapse the sticky sidebar into an accordion or clean top navigation bar.

---

## 7. Spec Self-Review

* **Placeholder Scan**: No `TODO`, `TBD`, or ambiguous placeholders. All licensing rules, age limits, and data handling procedures are explicitly specified.
* **Internal Consistency**: The dual-layer IP model cleanly aligns with both user rights and platform engine continuity requirements.
* **Scope Check**: Tightly scoped to the ToS and Privacy Policy content, its dedicated App Router presentation pages, and navigation touchpoints.
