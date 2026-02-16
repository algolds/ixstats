# IxStats Premium Features Matrix

**Last Updated:** November 2025 (v1.42)

This document provides a comprehensive breakdown of features available in the Basic (Free) tier versus the MyCountry Premium tier.

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

**MyCountry Premium** ($9.99/month)
- Everything in Basic tier
- **Intelligence Dashboard** - Full 5-tab analytics suite
- **Advanced Analytics** - Enhanced data access and unlimited exports
- **ThinkPages Pro** - 50 accounts (vs 5 basic)
- **Higher Rate Limits** - 10x API limits (1000/min vs 100/min)
- **Historical Data** - Unlimited access (vs 30-day limit)
- Priority support

### Premium Feature Flags

From `/src/lib/membership.ts`:

```typescript
interface PremiumFeatures {
  sdi: boolean;                  // DEPRECATED - Legacy flag (always false)
  eci: boolean;                  // DEPRECATED - Legacy flag (always false)
  intelligence: boolean;         // Intelligence Dashboard (ACTIVE)
  advancedAnalytics: boolean;    // Advanced Analytics & Exports (ACTIVE)
}
```

**Active Premium Features:**
- ✅ **Intelligence Dashboard** - Full 5-tab analytics suite
- ✅ **Advanced Analytics** - Enhanced data access and exports
- ✅ **ThinkPages Pro** - 50 accounts vs 5 for basic
- ✅ **Higher Rate Limits** - 1000/min vs 100/min
- ✅ **Unlimited Exports** - 1000/day vs 5/day

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
| → Intelligence Page | **Analytics dashboard** | ⚠️ Limited | ✅ Full | **PREMIUM GATED** |
| → Defense & Security | Force management | ✅ | ✅ | Available to all |
| → Map Editor | Territory editing | ✅ | ✅ | Geometry tools free |
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
| → Account Management | **Multiple accounts** | ⚠️ 5 max | ✅ 50 max | **PREMIUM BENEFIT** |
| → Document Storage | ThinkPages documents | ⚠️ 50 docs | ✅ 500 docs | More storage for premium |
| → Rate Limiting | API request limits | ⚠️ 100/min | ✅ 1000/min | Higher limits for premium |
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
| → Reference Data CMS | 18 admin interfaces | Admin Only | Admin Only | Content management |
| → Storyteller Panel | DM controls | Admin Only | Admin Only | Game master tools |
| → User Management | User admin | Admin Only | Admin Only | Super admin only |

---

## Premium Feature Details

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

**File:** `/src/lib/membership.ts`

```typescript
export async function getUserMembership(clerkUserId?: string): Promise<{
  tier: MembershipTier;
  isPremium: boolean;
  features: PremiumFeatures;
}> {
  // ... implementation
}

export async function checkFeatureAccess(
  feature: keyof PremiumFeatures,
  clerkUserId?: string
): Promise<boolean> {
  const membership = await getUserMembership(clerkUserId);
  return membership.features[feature];
}
```

### Client-Side Gating

**Component:** `<PremiumGate>`

```tsx
import { PremiumGate } from "~/components/ui/premium-gate";

<PremiumGate feature="intelligence">
  <IntelligenceDashboard />
</PremiumGate>
```

**Hook:** `usePremium()`

```tsx
import { usePremium } from "~/hooks/usePremium";

function MyComponent() {
  const { isPremium, features } = usePremium();

  if (!features.sdi) {
    return <UpgradePrompt />;
  }

  return <SDIDashboard />;
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
// Protected endpoint example
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const hasAccess = await checkFeatureAccess('intelligence', ctx.auth.userId);
  if (!hasAccess) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

---

## Navigation Impact

### Premium Feature Indicators

- 🔒 **Lock Icons** - Shown on premium-gated features for basic users
- 💎 **Premium Badges** - Displayed on premium feature cards
- **Upgrade Prompts** - Contextual upgrade suggestions when accessing premium features
- **Feature Previews** - Limited previews of premium features for basic users

### Intelligence Page Behavior

**Basic Users:**
- See intelligence page in navigation
- Access settings tab only
- View upgrade prompt with feature preview
- Can explore sample intelligence data

**Premium Users:**
- Full access to all 5 intelligence tabs
- No upgrade prompts
- Advanced alert configuration
- Historical data analysis

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

- [Intelligence System Documentation](./systems/intelligence.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Rate Limiting Guide](./RATE_LIMITING_GUIDE.md)
- [User Profile Utils](./USER_PROFILE_UTILS_USAGE.md)

---

**For Support:**
- In-app: Settings → Help & Support
- Email: support@ixstats.com
- Discord: [IxStats Community Server]

**Last Review:** November 8, 2025
**Version:** 1.42
