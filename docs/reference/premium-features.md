# IxStats Premium Features Matrix

**Last Updated:** September 2026 (platform: IxStates 1.4.0 "Lobster Crosby", Release Candidate — see [revision.md](./revision.md))

This document provides a comprehensive breakdown of features available in the Basic (Free) tier versus the MyCountry Premium tier.

> **Implementation status (verified against code, 2026-09-29).** Most of this matrix is the *planned* product. What is actually enforced today:
>
> | Enforced | Where |
> |---|---|
> | Tier flag `User.membershipTier` (`"basic"` \| `"mycountry_premium"`), set by admins only | `/admin/membership` → `users.updateMembershipTier` |
> | Server gate on 10 Defense/Security procedures (military assets, operations, conflicts, security events) | `premiumProcedure` / `premiumMiddleware` in `src/server/api/trpc/` |
> | Defense domain renders as a read-only preview with an Upgrade banner for non-premium users (`/mycountry/intelligence` resolves to the same Defense domain) | `PremiumPreviewFrame`, `DomainSurface.tsx`, `ability.can("access", "MyCountryFeature", "defense")` |
> | Intelligence/Defense nav items locked or hidden for non-premium users | `MyCountrySidebarNav.tsx` |
>
> **Not implemented:** payments/subscriptions (no Stripe or checkout; no $9.99 billing), a separate 5-tab Intelligence Dashboard, tiered API rate limits (everyone gets the same limits, e.g. 100 req/min on `rateLimitMiddleware`), export quotas, 30-day history limits, custom reports, document/scenario/alert quotas, and premium ThinkPages limits (every user is capped at **25** ThinkPages accounts). Vault's `premiumMultiplier` is display-only. Owners/admins/staff pass the client-side ability check (`src/lib/auth/ability.ts`) but not `premiumMiddleware`, which checks `membershipTier` only.

---

## Table of Contents

- [Membership Overview](#membership-overview)
- [Complete Feature Matrix](#complete-feature-matrix)
- [Premium Feature Details](#premium-feature-details)
- [Usage Limits](#usage-limits)
- [Pricing Information](#pricing-information)
- [Implementation Details](#implementation-details)

---

## Membership Overview

### Tier Structure

**Basic (Free)**
- Default tier for all registered users
- Full access to core gameplay mechanics
- Country creation and management
- Basic diplomacy and defense systems
- Social platform (ThinkPages)
- Public data browsing

**MyCountry Premium** ($9.99/month — *planned; no billing integration exists*)
- Everything in Basic tier
- **Intelligence Dashboard** - Full 5-tab analytics suite
- **Advanced Analytics** - Enhanced data access and unlimited exports
- **ThinkPages Pro** - 50 accounts (vs 5 basic)
- **Higher Rate Limits** - 10x API limits (1000/min vs 100/min)
- **Historical Data** - Unlimited access (vs 30-day limit)
- Priority support

### Premium Feature Flags

From `src/hooks/usePremium.tsx` (data from `users.getMembershipStatus` in `src/server/api/routers/users/country-linking.ts`; every flag simply mirrors `isPremium`):

```typescript
interface PremiumFeatures {
  intelligence: boolean;
  defense: boolean;
  advancedAnalytics: boolean;
}
```

**Premium Features — actual state:**
- ✅ **Defense & Security actions** - Enforced server-side (`premiumProcedure`) and client-side (read-only preview)
- ⚠️ **Intelligence** - Nav gating only; `/mycountry/intelligence` shows the Defense domain
- ❌ **Advanced Analytics** - Flag exists, nothing reads it
- ❌ **ThinkPages Pro** - Not implemented (flat 25-account cap for all users)
- ❌ **Higher Rate Limits** - Not implemented
- ❌ **Unlimited Exports** - Not implemented

---

## Complete Feature Matrix

| Feature Category | Feature | Basic | Premium | Notes |
|-----------------|---------|-------|---------|-------|
| **Core Platform** | | | | |
| → Account & Authentication | User accounts via Clerk | ✅ | ✅ | Free for all users |
| → Dashboard | Personal dashboard | ✅ | ✅ | Basic analytics for free |
| → Explore Countries | Browse all countries | ✅ | ✅ | Public data access |
| → Country Search | Search and filter | ✅ | ✅ | Full search capabilities |
| → Leaderboards | View rankings | ✅ | ✅ | Global rankings visible |
| → Wiki Integration | IxWiki content | ✅ | ✅ | MediaWiki integration |
| | | | | |
| **MyCountry System** | | | | |
| → Overview Page | National dashboard | ✅ | ✅ | Basic vitals for all |
| → Executive Command | Policy management | ✅ | ✅ | Available to country owners |
| → Policy Editor | Adjust governance settings | ✅ | ✅ | Basic editing free |
| → Diplomacy Page | Embassy network & missions | ✅ | ✅ | Basic diplomacy free |
| → Diplomatic Events | Event responses | ✅ | ✅ | Crisis responses available |
| → Intelligence Page | **Analytics dashboard** | ⚠️ Limited | ✅ Full | Nav-gated; route resolves to Defense domain |
| → Defense & Security | Force management | ⚠️ Read-only preview | ✅ | **PREMIUM GATED** (enforced) |
| → Map Editor | Territory editing | ✅ | ✅ | `ability.ts` marks it premium, but no UI/route enforces it |
| → Editor | Country editor page | ✅ | ✅ | Available to all |
| | | | | |
| **Country Builder** | | | | |
| → Create Country | Country creation wizard | ✅ | ✅ | Free to create |
| → Import from Wiki | Wikipedia import | ✅ | ✅ | Import tools free |
| → Atomic Government | 24 components | ✅ | ✅ | Full access |
| → Economic Systems | 40+ policies | ✅ | ✅ | All components free |
| → Tax Builder | 42 tax components | ✅ | ✅ | Tax system free |
| → Government Budget | Budget management | ✅ | ✅ | Basic budgeting free |
| | | | | |
| **Intelligence & Analytics** | | | | |
| → Basic Intelligence | Country overview data | ✅ | ✅ | Public intelligence |
| → Intelligence Dashboard | **Full analytics suite** | ❌ | ✅ | **PREMIUM ONLY** |
| → → Dashboard Tab | Executive insights summary | ❌ | ✅ | **PREMIUM ONLY** |
| → → Economic Tab | **GDP trends & forecasts** | ❌ | ✅ | **PREMIUM ONLY** |
| → → Diplomatic Tab | **Network visualization** | ❌ | ✅ | **PREMIUM ONLY** |
| → → Policy Tab | **Effectiveness analysis** | ❌ | ✅ | **PREMIUM ONLY** |
| → → Forecasting Tab | **Predictive models** | ❌ | ✅ | **PREMIUM ONLY** |
| → → Settings Tab | Alert configuration | ✅ | ✅ | Available to all |
| → Historical Data | **Time-series analysis** | ⚠️ 30 days | ✅ Unlimited | Limited free access |
| → Custom Reports | Save custom reports | ⚠️ 5 max | ✅ Unlimited | More for premium |
| | | | | |
| **Social Platform (ThinkPages)** | | | | |
| → ThinkPages Feed | Social feed & posts | ✅ | ✅ | Public platform |
| → ThinkTanks | Group collaboration | ✅ | ✅ | Free for all |
| → ThinkShare Messages | Secure messaging | ✅ | ✅ | Basic messaging free |
| → Account Management | **Multiple accounts** | 25 max | 25 max | Planned: 5 / 50 (not implemented) |
| → Document Storage | ThinkPages documents | ⚠️ 50 docs | ✅ 500 docs | More storage for premium |
| → Rate Limiting | API request limits | 100/min | 100/min | Planned premium tier not implemented |
| | | | | |
| **Data & Export** | | | | |
| → View Economic Data | Current statistics | ✅ | ✅ | Basic viewing free |
| → Historical Data Access | **Time-series data** | ⚠️ Limited | ✅ Full | **Restricted for basic** |
| → Data Export (CSV/JSON) | **Export capabilities** | ⚠️ 5/day | ✅ 1000/day | **10x more exports** |
| → Advanced Visualizations | **Custom charts** | ⚠️ Limited | ✅ Full | Enhanced for premium |
| → Custom Dashboards | **Personalized views** | ⚠️ Limited | ✅ Unlimited | More customization |
| | | | | |
| **Administrative** | | | | |
| → Admin Panel | System administration | Admin Only | Admin Only | Role-based |
| → Reference Data CMS | 20 admin interfaces | Admin Only | Admin Only | Content management |
| → Storyteller Panel | DM controls | Admin Only | Admin Only | Game master tools |
| → User Management | User admin | Admin Only | Admin Only | Super admin only |

---

## Premium Feature Details

> The feature descriptions below are the **planned** premium scope. See the implementation status at the top of this page for what ships today.

### 1. Intelligence Dashboard (`intelligence: true`)

**Location:** `/mycountry/intelligence`

**Five Interactive Tabs:**

1. **Dashboard Tab** - Executive-level insights
   - National vitals summary
   - Economic health indicators
   - Diplomatic standing overview
   - Security status alerts
   - Quick action recommendations

2. **Economic Tab** - GDP trends & sector analysis
   - GDP growth time-series charts
   - Sector performance breakdown
   - Employment trends
   - Trade balance visualization
   - Economic forecasting models

3. **Diplomatic Tab** - Network visualization & trends
   - Relationship network graph
   - Embassy effectiveness metrics
   - Mission success rates
   - Cultural exchange impacts
   - Diplomatic influence scores

4. **Policy Tab** - Effectiveness analysis
   - Policy impact simulations
   - Component effectiveness scores
   - Synergy detection
   - Optimization recommendations
   - Historical policy performance

5. **Forecasting Tab** - Predictive modeling
   - Economic growth projections
   - Population trend forecasts
   - Diplomatic relationship predictions
   - Risk assessment models
   - Scenario planning tools

**Settings Tab** (All Tiers):
- Alert threshold configuration
- Notification preferences
- Dashboard customization

---

### 2. Advanced Analytics (`advancedAnalytics: true`)

**Purpose:** Enhanced data analysis and export capabilities

**Features:**

- **Historical Data Analysis**
  - Full time-series data access (vs. 30-day limit for basic)
  - Custom date range selection
  - Comparative historical analysis
  - Trend detection algorithms

- **Advanced Visualizations**
  - Custom chart creation
  - Multi-variable correlation plots
  - Heat maps and geo-spatial analysis
  - Interactive data exploration

- **Enhanced Export Capabilities**
  - Unlimited daily exports (vs. 5/day for basic)
  - CSV, JSON, and Excel formats
  - Bulk data downloads
  - Scheduled automated exports

- **Custom Dashboards**
  - Personalized metric selection
  - Drag-and-drop dashboard builder
  - Multiple saved dashboard layouts
  - Share dashboards with team members

---

## Usage Limits

> **Planned — none of these limits are enforced in code.** All users currently share the same limits (e.g. 25 ThinkPages accounts, standard tRPC rate limits).

### Rate Limits

| Resource | Basic | Premium | Benefit |
|----------|-------|---------|---------|
| API Requests/Minute | 100 | 1000 | **10x faster** |
| Data Exports/Day | 5 | 1000 | **200x more** |
| ThinkPages Accounts | 5 | 50 | **10x accounts** |
| Historical Data Access | 30 days | Unlimited | **Full history** |

### Storage Limits

| Resource | Basic | Premium | Benefit |
|----------|-------|---------|---------|
| ThinkPages Documents | 50 | 500 | **10x storage** |
| Saved Scenarios | 3 | 50 | **16x scenarios** |
| Custom Reports | 5 | Unlimited | **No limits** |
| Intelligence Alerts | 3 | Unlimited | **Unlimited alerts** |

---

## Pricing Information

### MyCountry Premium

> **Planned.** There is no payment provider, checkout, or subscription code in the repository; premium is granted manually by admins at `/admin/membership`.

**Monthly Subscription:** $9.99/month
- Cancel anytime
- No long-term commitment
- Instant access to all premium features
- Priority customer support
- Early access to beta features

**Payment Methods:**
- Credit/Debit Cards (via Stripe)
- PayPal (coming soon)
- Regional payment methods (varies by country)

**Upgrade Process:**
1. Navigate to Profile Settings
2. Click "Upgrade to Premium"
3. Enter payment information
4. Instant activation

**Cancellation Policy:**
- Cancel anytime from Profile Settings
- Access continues until end of billing period
- No refunds for partial months
- Can re-subscribe at any time

---

## Implementation Details

### Server-Side Feature Gating

**Membership status:** `users.getMembershipStatus` (`src/server/api/routers/users/country-linking.ts`) returns `{ tier, isPremium, features }`, where every feature flag equals `isPremium`. Admins change tiers with `users.updateMembershipTier` (`adminProcedure`). There is no `src/lib/membership.ts`.

**Procedure gate:** `premiumProcedure` (`src/server/api/trpc/procedures.ts`) = authenticated procedure + `premiumMiddleware` (`src/server/api/trpc/middleware.ts`), which throws `ForbiddenError("MyCountry Premium membership required")` unless `ctx.user.membershipTier === "mycountry_premium"`.

### Client-Side Gating

**Component:** `<PremiumPreviewFrame>` (`src/components/mycountry/shared/primitives/PremiumPreviewFrame.tsx`) — renders real content read-only (`canEdit=false`) with an Upgrade banner when `locked`.

```tsx
import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives";

<PremiumPreviewFrame
  feature="defense"
  locked={!ability.can("access", "MyCountryFeature", "defense")}
>
  <DefenseCommandPanel countryId={countryId} />
</PremiumPreviewFrame>
```

**Hooks:** `usePremium()`, `useFeatureAccess(feature)`, `usePremiumGate()` (`src/hooks/usePremium.tsx`)

```tsx
import { usePremium } from "~/hooks/usePremium";

function MyComponent() {
  const { isPremium, features } = usePremium();

  if (!features.defense) {
    return <UpgradePrompt />;
  }

  return <DefenseTools />;
}
```

### Database Schema

**User Model:**
```prisma
model User {
  id             String   @id @default(cuid())
  clerkUserId    String   @unique
  membershipTier String?  // "basic" | "mycountry_premium"
  // ... other fields
}
```

### tRPC Endpoint Protection

```typescript
import { createTRPCRouter, premiumProcedure } from "~/server/api/trpc";

export const militaryRouter = createTRPCRouter({
  createMilitaryAsset: premiumProcedure
    .input(/* zod schema */)
    .mutation(async ({ ctx, input }) => {
      /* only reached when membershipTier === "mycountry_premium" */
    }),
});
```

Current `premiumProcedure` users: `security/military.ts`, `security/operations.ts`, `security/conflicts.ts`, `security/stability.ts`.

---

## Navigation Impact

### Premium Feature Indicators

- 🔒 **Lock Icons** - Shown on premium-gated features for basic users
- 💎 **Premium Badges** - Displayed on premium feature cards
- **Upgrade Prompts** - Contextual upgrade suggestions when accessing premium features
- **Feature Previews** - Limited previews of premium features for basic users

### Intelligence & Defense Page Behavior

**Basic Users:**
- Intelligence/Defense nav items are hidden unless an admin enables `showIntelligenceTab` / `showDefenseTab`, in which case they show as locked "(Premium)" teasers
- `/mycountry/defense` (and `/mycountry/intelligence`, which resolves to the Defense domain) renders a read-only live preview with an Upgrade banner (links to `/help/getting-started/welcome`)
- Defense mutations are rejected server-side

**Premium Users:**
- Full Defense command access with editing enabled
- "Premium" badge in the MyCountry sidebar
- The planned 5-tab Intelligence Dashboard does not exist yet

---

## Freemium Model Philosophy

IxStats follows a **generous freemium model**:

### Core Gameplay is Free ✅
- Country creation and management
- Atomic government and economic systems (106 components)
- Diplomacy and defense mechanics
- Social platform (ThinkPages - 5 accounts, 50 documents)
- Map editing tools
- Basic intelligence viewing (Settings tab only)
- 30-day historical data access
- 5 exports per day

### Premium Unlocks Power Tools 💎
- **Full Intelligence Dashboard** - All 5 analytics tabs
- **10x ThinkPages Scale** - 50 accounts, 500 documents
- **Unlimited Data Access** - Full historical data, no limits
- **200x More Exports** - 1000/day vs 5/day
- **10x API Speed** - 1000/min vs 100/min
- **Advanced Forecasting** - Economic and diplomatic predictions
- **Custom Reports** - Unlimited saved reports and dashboards

**Philosophy:** Users can fully enjoy the simulation game for free with 5 ThinkPages accounts and basic analytics. Premium is for players who want professional-grade intelligence tools, unlimited data access, and the ability to manage complex multi-account operations (50 accounts for serious roleplay or diplomatic networks).

### 3. ThinkPages Pro

**Purpose:** Enhanced social platform capabilities

**Features:**

- **50 ThinkPages Accounts** (vs 5 for basic)
  - Multiple diplomatic personas
  - Different character accounts
  - Organization accounts
  - Test/sandbox accounts

- **500 Document Storage** (vs 50 for basic)
  - More collaborative documents
  - Larger document library
  - Version history retention
  - Advanced formatting options

- **Priority Publishing**
  - Featured posts option
  - Longer post length limits
  - Rich media embeds
  - Custom post styling

---

## Upgrade Benefits Summary

### Why Upgrade to Premium?

1. **Unlock Full Intelligence** - Complete 5-tab analytics dashboard
2. **Analyze Everything** - Unlimited historical data and custom reports
3. **Scale Your Presence** - 50 ThinkPages accounts vs 5 basic
4. **Export Unlimited Data** - 1000 exports/day vs 5/day
5. **Work 10x Faster** - 1000 API requests/min vs 100/min
6. **See Trends & Forecasts** - Economic and diplomatic predictions

### Best For:

- 🎮 **Serious Players** - Competitive intelligence advantage
- 📊 **Data Enthusiasts** - Full analytics and unlimited exports
- 🏛️ **Roleplayers** - Multiple ThinkPages personas (50 accounts)
- 📈 **Strategists** - Forecasting and trend analysis
- 🤝 **Diplomats** - Network visualization and relationship insights
- 📝 **Content Creators** - 500 document storage and priority features

---

## Related Documentation

- [Intelligence System Documentation](../systems/intelligence.md)
- [API Catalog](./api-complete.md)
- [Rate Limiting Guide](../operations/rate-limiting.md)
- [User Profile Utils](./user-profile-utils.md)

---

**For Support:**
- In-app: Settings → Help & Support
- Email: support@ixstats.com
- Discord: [IxStats Community Server]

**Last Review:** September 2026
**Platform:** IxStates 1.4.0 "Lobster Crosby" (Release Candidate)
