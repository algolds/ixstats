# 🏛️ MyCountry Intelligence & Recon (Folded into Defense)

**Last updated:** 2026-10-05

**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 6`)  
**Engine:** Statecraft Simulation Engine (`MYCOUNTRY_ENGINE_VERSION = 4`)  
**Primary Action:** `SURVEY` | **Domain Accent:** Dark Indigo / Amber Gold  
**Route:** `/mycountry/intelligence` → renders the **Defense** section | **Status:** 💎 Premium-gated · partial  

> **⚠️ Status Note:** There is no standalone Intelligence dashboard in the current build. `getSectionFromPathname()` maps `/mycountry/intelligence` to the premium Defense surface. Threshold alerts are shown on the MyCountry overview instead (see below). The old intelligence stack was removed as dead code (plans 312/341): `EnhancedIntelligenceContent`, `IntelligenceFeed`, `DiplomaticOperationsHub`, `LiveDiplomaticFeed`, the `diplomatic-intelligence` router, `intelligence.getExecutiveDashboard`, and `intelligence.getAlerts`. What remains is spread across the Statecraft "SEE" step below.

Intelligence in IxStates is the **recon / fog-of-information** layer: what your government can see depends on its capacity, its departments, and its reach abroad. The engine may withhold or caveat, but never fabricates.

---

## Where Intelligence Lives Today

| Capability | Code | Status |
| :--- | :--- | :--- |
| **Domestic recon on National Issues** | `nationalIssues.commissionRecon` / `getReconReveal` (`src/lib/statecraft/recon.ts`, 20 CivCap reserved per recon) | Built, but gated by `STATECRAFT_SPINE` (default **off**) |
| **Foreign intel on other nations** | `src/lib/statecraft/diplo-intel.ts` (`revealed` / `questioned` / `greyed` by embassy + relation strength), shown in `RelationsRail` and `DiplomaticRelationsList` | Live |
| **Policy fog warnings** | `policies.getPolicyReconContext` → `PolicyReconBanner` (over-capacity, effectiveness < 45%) | Live (warnings only, no numeric masking) |
| **Fogged whip count** | `legislation.previewBillVote` (`src/lib/statecraft/whip.ts`) | Live |
| **Threat & border assessment** | `security.getSecurityAssessment`, `security.getBorderSecurity` → `BorderThreatPanel` (Defense) | Live, premium |
| **Threshold alerts** | Thresholds are set in notification preferences (`notifications.preferences`); `evaluateThresholds` (`src/server/shared/intelligence-alert-thresholds.ts`) runs after a country update and writes an `IntelligenceAlert` plus a notification for each breached band, skipping breaches that already have an open alert. The owner reads them in the **Intelligence alerts** card at the top of the MyCountry overview rail (`shell/IntelligenceAlertsCard.tsx`, shown only while alerts are open). `intelligence.getMyAlerts` lists them most severe first with open and unread counts; `markAlertRead`, `markAllAlertsRead` and `dismissAlert` (resolves it; a still-breached metric raises a fresh alert on the next evaluation) are owner or privileged only. Notifications link to `/mycountry?focus=alerts`, which scrolls to the card | Live |
| **Intelligence templates** | `intelligence.getAllTemplates` / `createTemplate` / `updateTemplate` / `deleteTemplate` (admin, `/admin/intelligence-templates`); no reader since `diplomaticCore.getSharedData` was removed (it returned derived/invented figures) | Live (admin) |

---

## Caching

`globalCache` (`src/lib/cache/advanced-cache-system.ts`) backs cached reads, falling back to in-memory storage when Redis is unavailable.

---

## Data Models

Defined in `prisma/schema/intelligence.prisma`:
- `IntelligenceTemplate`: Admin-authored intel/briefing templates (in use)
- `IntelligenceAlert`: threshold-breach alerts (written by `evaluateThresholds`, read by `intelligence.getMyAlerts`); `readAt` records when the owner read one, `isResolved` / `resolvedAt` when they dismissed it
- `IntelligenceAlertThreshold`: per-user metric bands (`notifications.preferences`)
- `IntelligenceItem`, `IntelligenceBriefing`, `IntelligenceRecommendation`: Legacy briefing models — no router currently reads or writes them
- `VitalitySnapshot`: Vitality time-series model — defined, but no live code path writes it (`src/lib/intelligence/calculator.ts` has no callers)

---

## Related Documentation

- [Diplomacy System](./diplomacy.md)
- [Defense & Security System](./defense.md)
- [MyCountry Command Suite](./mycountry.md)
- [API Reference: Intelligence Routers](../reference/api-complete.md#intelligence--diplomacy)
