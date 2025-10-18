# Remaining TODO/FIXME Items
**Last Updated:** 2025-10-16
**Total Items:** 36
**Status:** All documented and prioritized

This document tracks all TODO and FIXME comments found in the codebase. Each item is categorized by priority and includes file location, context, and recommended action.

---

## Quick Reference

| Priority | Count | Estimated Effort | Target Release |
|----------|-------|------------------|----------------|
| 🔴 HIGH  | 10    | 4-6 hours       | v1.1.1 (Immediate) |
| 🟡 MEDIUM| 10    | 8-11 hours      | v1.1.2 (Next Sprint) |
| 🟢 LOW   | 16    | 20-28 hours     | v1.2.0 (Future) |

---

## 🔴 HIGH PRIORITY (Critical Type Safety)

### 1. ThinkShare Client State Types (4 occurrences)

**Impact:** Type safety issues, potential runtime errors
**Effort:** 2-3 hours
**Blocking:** No

#### Files Affected:
1. `src/components/thinkshare/ConversationListContent.tsx:52`
2. `src/components/thinkshare/MessageList.tsx:45`
3. `src/components/thinkshare/ConversationCard.tsx:51`
4. `src/components/thinkshare/ConversationList.tsx:53`

#### Current Code:
```typescript
clientState: any; // TODO: Define a proper type for clientState
selectedConversation: any; // TODO: Define a proper type for selectedConversation
```

#### Recommended Fix:
Create `src/types/thinkshare.ts`:
```typescript
export interface ThinkShareClientState {
  connected: boolean;
  authenticated: boolean;
  userId: string | null;
  accountId: string | null;
  subscriptions: string[];
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date | null;
  unreadCount: number;
  typingIndicators: Record<string, boolean>;
}

export interface ConversationState {
  id: string;
  participants: string[];
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    timestamp: Date;
  } | null;
  unreadCount: number;
  isTyping: boolean;
  metadata?: Record<string, any>;
}
```

#### Migration Steps:
1. Create types file
2. Import in all 4 files
3. Replace `any` with proper types
4. Test ThinkShare functionality
5. Verify no type errors in IDE

---

### 2. Media Search Type Casts (2 occurrences)

**Impact:** Type safety bypass, potential bugs
**Effort:** 1 hour
**Blocking:** No

#### Files Affected:
1. `src/components/MediaSearchModal.tsx:65`
2. `src/components/MediaSearchModal.tsx:80`

#### Current Code:
```typescript
) as any; // TODO: Fix type properly
```

#### Recommended Fix:
Define proper return types:
```typescript
interface MediaSearchResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'document';
  source: 'wikimedia' | 'local' | 'external';
  metadata?: {
    width?: number;
    height?: number;
    fileSize?: number;
    format?: string;
  };
}

interface MediaSearchResponse {
  results: MediaSearchResult[];
  totalCount: number;
  nextPage?: string;
}
```

---

### 3. Editor Feedback Type (1 occurrence)

**Impact:** Type safety in editor hooks
**Effort:** 30 minutes
**Blocking:** No

#### File: `src/app/mycountry/editor/hooks/useCountryEditorData.ts:35`

#### Current Code:
```typescript
const [feedback, setFeedback] = useState<any>(null); // TODO: Define a proper type for feedback
```

#### Recommended Fix:
```typescript
interface EditorFeedback {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  field?: string;
  details?: string;
  timestamp: Date;
  dismissible: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
```

---

### 4. Bot Monitoring Details Type (1 occurrence)

**Impact:** Type safety in monitoring
**Effort:** 15 minutes
**Blocking:** No

#### File: `src/app/_components/bot-monitoring.tsx:51`

#### Current Code:
```typescript
details?: unknown; // TODO: Replace with specific type
```

#### Recommended Fix:
```typescript
interface BotMonitoringDetails {
  status: 'online' | 'offline' | 'error' | 'maintenance';
  uptime: number;
  lastPing: Date;
  version: string;
  performance: {
    responseTime: number;
    queueDepth: number;
    errorRate: number;
  };
  connections: {
    discord: boolean;
    database: boolean;
    websocket: boolean;
  };
}
```

---

### 5. User Activity Analytics Calculations (2 occurrences)

**Impact:** Incomplete analytics data
**Effort:** 1-2 hours
**Blocking:** No

#### File: `src/lib/user-activity-analytics.ts:199, 212`

#### Current Code:
```typescript
averageSessionDuration: 0, // TODO: Calculate from session data
dailyActiveMinutes: 0, // TODO: Calculate from session data
```

#### Recommended Fix:
```typescript
// Calculate average session duration
const sessions = await db.userSession.findMany({
  where: {
    userId,
    startTime: { gte: startDate, lte: endDate }
  }
});

const averageSessionDuration = sessions.length > 0
  ? sessions.reduce((sum, session) => {
      const duration = session.endTime
        ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
        : 0;
      return sum + duration;
    }, 0) / sessions.length
  : 0;

// Calculate daily active minutes
const dailyActiveMinutes = sessions.reduce((sum, session) => {
  const minutes = session.endTime
    ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 60000)
    : 0;
  return sum + minutes;
}, 0);
```

---

## 🟡 MEDIUM PRIORITY (Data Model & Infrastructure)

### 6. Security Router Database Fields (8 occurrences)

**Impact:** Hardcoded security calculations, inaccurate metrics
**Effort:** 2-3 hours
**Blocking:** No

#### File: `src/server/api/routers/security.ts` (lines 734-760)

#### Current Code:
```typescript
ethnicDiversity: 40, // TODO: Add to Demographics model (line 745)
religiousDiversity: 30, // TODO: Add to Demographics model (line 746)
politicalStability: 0.5, // TODO: Add to Country/GovernmentStructure model (line 753)
politicalPolarization: 45, // TODO: Add to Country/GovernmentStructure model (line 754)
electionCycle: 2, // TODO: Get from government data (line 755)
democracyIndex: 70, // TODO: Add to GovernmentStructure model (line 756)
// Get government data - TODO: integrate with government ministry when available (line 734)
// TODO: Get recent policies from database (line 760)
```

#### Recommended Fix:

**Step 1:** Update Prisma Schema (`prisma/schema.prisma`):
```prisma
model Demographics {
  // ... existing fields ...

  // Social diversity metrics
  ethnicDiversity       Float?   @default(50)  // 0-100 scale
  religiousDiversity    Float?   @default(50)  // 0-100 scale
  linguisticDiversity   Float?   @default(30)  // 0-100 scale
  culturalDiversity     Float?   @default(50)  // 0-100 scale

  // Metadata
  diversityLastUpdated  DateTime?
  diversitySource       String?  // 'manual' | 'calculated' | 'imported'
}

model GovernmentStructure {
  // ... existing fields ...

  // Political stability metrics
  politicalStability    Float?   @default(0.5)  // -1 to 1 scale
  politicalPolarization Float?   @default(50)   // 0-100 scale
  democracyIndex        Float?   @default(50)   // 0-100 scale (0=authoritarian, 100=full democracy)
  electionCycle         Int?     @default(4)    // Years between elections

  // Government effectiveness
  governmentEffectiveness Float? @default(50)  // 0-100 scale
  ruleOfLaw              Float?  @default(50)  // 0-100 scale
  corruptionIndex        Float?  @default(50)  // 0-100 scale (0=clean, 100=corrupt)

  // Metadata
  politicalMetricsUpdated DateTime?
}

model Policy {
  id            String   @id @default(cuid())
  countryId     String
  country       Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  name          String
  category      String   // 'economic' | 'social' | 'security' | 'diplomatic' | 'environmental'
  description   String?

  // Policy details
  status        String   // 'draft' | 'proposed' | 'active' | 'suspended' | 'repealed'
  priority      String   // 'low' | 'medium' | 'high' | 'critical'

  // Timeline
  proposedDate  DateTime?
  enactedDate   DateTime?
  expiryDate    DateTime?

  // Impact tracking
  publicSupport Float?   // 0-100 scale
  effectiveness Float?   // 0-100 scale

  // Relations
  authorId      String?
  author        User?    @relation(fields: [authorId], references: [id])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([countryId])
  @@index([status])
  @@index([category])
}
```

**Step 2:** Run Migration:
```bash
npm run db:generate
npx prisma migrate dev --name add_political_security_metrics
```

**Step 3:** Update Security Router:
```typescript
// Get diversity data from Demographics
const demographics = await db.demographics.findUnique({
  where: { countryId },
  select: {
    ethnicDiversity: true,
    religiousDiversity: true,
    linguisticDiversity: true,
    culturalDiversity: true,
  }
});

// Get political metrics from GovernmentStructure
const government = await db.governmentStructure.findUnique({
  where: { countryId },
  select: {
    politicalStability: true,
    politicalPolarization: true,
    democracyIndex: true,
    electionCycle: true,
    governmentEffectiveness: true,
    ruleOfLaw: true,
  }
});

// Get recent policies
const recentPolicies = await db.policy.findMany({
  where: {
    countryId,
    status: 'active',
    enactedDate: {
      gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
    }
  },
  orderBy: { enactedDate: 'desc' },
  take: 10
});

// Calculate security force size using real data
const ethnicDiversity = demographics?.ethnicDiversity ?? 50;
const religiousDiversity = demographics?.religiousDiversity ?? 50;
const politicalStability = government?.politicalStability ?? 0.5;
const politicalPolarization = government?.politicalPolarization ?? 50;
```

**Step 4:** Add Data Seeding:
```typescript
// Add to init-db.ts or create separate seeder
async function seedPoliticalMetrics() {
  // Seed default political metrics for existing countries
  const countries = await db.country.findMany({
    include: {
      governmentStructure: true,
      demographics: true
    }
  });

  for (const country of countries) {
    // Update government structure if it exists
    if (country.governmentStructure) {
      await db.governmentStructure.update({
        where: { id: country.governmentStructure.id },
        data: {
          politicalStability: calculatePoliticalStability(country),
          politicalPolarization: calculatePolarization(country),
          democracyIndex: calculateDemocracyIndex(country),
          electionCycle: getElectionCycle(country.governmentStructure.type),
        }
      });
    }

    // Update demographics if it exists
    if (country.demographics) {
      await db.demographics.update({
        where: { id: country.demographics.id },
        data: {
          ethnicDiversity: calculateEthnicDiversity(country),
          religiousDiversity: calculateReligiousDiversity(country),
        }
      });
    }
  }
}
```

**Estimated Effort:** 2-3 hours
**Impact:** More accurate security calculations, better intelligence data, foundation for policy system

---

### 7. Action Queue Notification Integration (1 occurrence)

**Impact:** Incomplete notification delivery
**Effort:** 3-4 hours
**Blocking:** No

#### File: `src/lib/action-queue-system.ts:406`

#### Current Code:
```typescript
// TODO: Integrate with notification center
```

#### Recommended Fix:
```typescript
import { UnifiedNotificationCenter } from '~/components/notifications/UnifiedNotificationCenter';

// In ActionQueue.processAction():
private async processAction(action: QueuedAction): Promise<void> {
  try {
    // ... existing processing logic ...

    // Send notification on success
    if (action.successNotification) {
      await UnifiedNotificationCenter.notify({
        type: 'toast',
        title: action.successNotification.title,
        message: action.successNotification.message,
        priority: 'medium',
        category: action.category,
        userId: action.userId,
        metadata: {
          actionId: action.id,
          actionType: action.type,
          result: result
        }
      });
    }

  } catch (error) {
    // Send error notification
    await UnifiedNotificationCenter.notify({
      type: 'toast',
      title: 'Action Failed',
      message: `${action.type} failed: ${error.message}`,
      priority: 'high',
      category: action.category,
      userId: action.userId,
      metadata: {
        actionId: action.id,
        error: error.message
      }
    });
  }
}
```

---

### 8. Error Monitoring Integration (1 occurrence)

**Impact:** No production error tracking
**Effort:** 3-4 hours
**Blocking:** No

#### File: `src/components/shared/feedback/DashboardErrorBoundary.tsx:119`

#### Current Code:
```typescript
// TODO: Integrate with monitoring service (e.g., Sentry, LogRocket, DataDog)
console.log('TODO: Send to monitoring service:', { ... });
```

#### Recommended Fix:

**Option 1: Sentry Integration**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
import * as Sentry from '@sentry/nextjs';

private logErrorToService(error: Error, errorInfo: ErrorInfo): void {
  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'DashboardErrorBoundary');
      scope.setContext('componentStack', {
        stack: errorInfo.componentStack
      });
      scope.setContext('user', {
        userId: this.props.userId,
        countryId: this.props.countryId
      });
      Sentry.captureException(error);
    });
  } else {
    console.error('Error caught by boundary:', error, errorInfo);
  }
}
```

**Option 2: LogRocket Integration**
```bash
npm install logrocket logrocket-react
```

```typescript
import LogRocket from 'logrocket';

// Initialize in _app.tsx
if (process.env.NODE_ENV === 'production') {
  LogRocket.init('your-app-id');
}

// In error boundary
private logErrorToService(error: Error, errorInfo: ErrorInfo): void {
  if (process.env.NODE_ENV === 'production') {
    LogRocket.captureException(error, {
      tags: {
        errorBoundary: 'DashboardErrorBoundary'
      },
      extra: {
        componentStack: errorInfo.componentStack,
        userId: this.props.userId,
        countryId: this.props.countryId
      }
    });
  }
}
```

**Recommended:** Sentry for error tracking, LogRocket for session replay (optional)

---

## 🟢 LOW PRIORITY (Feature Enhancements)

### 9. Premium Feature UI (2 occurrences)

**Impact:** Incomplete premium feature UX
**Effort:** 4-6 hours
**Blocking:** No

#### Files:
1. `src/components/ui/premium-gate.tsx:132` - Upgrade flow
2. `src/components/ui/premium-gate.tsx:145` - Learn more

#### Current Code:
```typescript
// TODO: Implement upgrade flow
// TODO: Implement learn more
```

#### Recommended Fix:
```typescript
// Create upgrade modal component
const handleUpgrade = () => {
  router.push('/premium/upgrade');
  // Or open modal:
  // openModal(<PremiumUpgradeModal feature={featureName} />);
};

const handleLearnMore = () => {
  router.push('/help/premium/features');
  // Or open documentation modal
};
```

Create `/src/app/premium/upgrade/page.tsx` with pricing tiers and payment integration.

---

### 10. ThinkPages Repost Tracking (1 occurrence)

**Impact:** Missing social feature
**Effort:** 2-3 hours
**Blocking:** No

#### File: `src/components/thinkpages/ThinkpagesPost.tsx:402`

#### Current Code:
```typescript
isReposted={false} // TODO: Track repost status
```

#### Recommended Fix:

**Step 1:** Add to schema:
```prisma
model ThinkPagesRepost {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  postId      String
  post        ThinkPagesPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  comment     String?  // Optional comment on repost
  createdAt   DateTime @default(now())

  @@unique([userId, postId])
  @@index([userId])
  @@index([postId])
}
```

**Step 2:** Add tRPC endpoint:
```typescript
repost: protectedProcedure
  .input(z.object({
    postId: z.string(),
    comment: z.string().optional()
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.thinkPagesRepost.create({
      data: {
        userId: ctx.userId,
        postId: input.postId,
        comment: input.comment
      }
    });
  }),

checkIsReposted: protectedProcedure
  .input(z.object({ postId: z.string() }))
  .query(async ({ ctx, input }) => {
    const repost = await ctx.db.thinkPagesRepost.findUnique({
      where: {
        userId_postId: {
          userId: ctx.userId,
          postId: input.postId
        }
      }
    });
    return { isReposted: !!repost };
  })
```

---

### 11. Admin User ID from Context (1 occurrence)

**Impact:** Hardcoded admin ID
**Effort:** 15 minutes
**Blocking:** No

#### File: `src/app/admin/_components/NotificationsAdmin.tsx:146`

#### Current Code:
```typescript
adminUserId: "admin", // TODO: Replace with actual admin user ID
```

#### Recommended Fix:
```typescript
import { useUser } from '~/context/auth-context';

const { user } = useUser();

// ...
adminUserId: user?.id || "system",
```

---

### 12. Economic Algorithm Enhancements (2 occurrences)

**Impact:** More realistic economic modeling
**Effort:** 6-8 hours
**Blocking:** No

#### File: `src/lib/enhanced-calculations.ts:262, 271`

#### Current Code:
```typescript
// TODO: Implement regional spillover effects
// TODO: Implement resource-based growth
```

#### Recommended Implementation:

**Regional Spillover Effects:**
```typescript
function calculateRegionalSpillover(
  country: Country,
  neighbors: Country[],
  economicData: EconomicData
): number {
  let spilloverEffect = 0;

  for (const neighbor of neighbors) {
    const tradeIntensity = calculateTradeIntensity(country, neighbor);
    const economicGap = neighbor.gdp - country.gdp;
    const proximityBonus = getProximityBonus(country, neighbor);

    // Positive spillover from more developed neighbors
    if (economicGap > 0) {
      spilloverEffect += (economicGap * tradeIntensity * proximityBonus) * 0.001;
    }

    // Technology transfer
    if (neighbor.techLevel > country.techLevel) {
      spilloverEffect += (neighbor.techLevel - country.techLevel) * tradeIntensity * 0.002;
    }
  }

  return Math.min(spilloverEffect, 0.05); // Cap at 5% boost
}
```

**Resource-Based Growth:**
```typescript
function calculateResourceBasedGrowth(
  country: Country,
  resources: NaturalResources
): number {
  let resourceBonus = 0;

  // Oil/Gas bonus
  if (resources.oil > 0 || resources.naturalGas > 0) {
    const energyValue = (resources.oil * OIL_PRICE_PER_BARREL) +
                       (resources.naturalGas * GAS_PRICE_PER_UNIT);
    resourceBonus += energyValue / country.gdp * 0.1;
  }

  // Mineral resources
  if (resources.minerals) {
    const mineralValue = Object.values(resources.minerals)
      .reduce((sum, val) => sum + val, 0);
    resourceBonus += mineralValue / country.gdp * 0.05;
  }

  // Agricultural potential
  if (resources.arableLand > 0) {
    resourceBonus += (resources.arableLand / country.landArea) * 0.02;
  }

  // Resource curse penalty for over-reliance
  const resourceDependence = resourceBonus;
  if (resourceDependence > 0.3) {
    resourceBonus *= 0.7; // 30% penalty for resource curse
  }

  return resourceBonus;
}
```

---

### 13-16. Disabled Feature Integrations (7 occurrences)

**Status:** Blocked by dependent systems
**Action:** Document and track, no immediate action required

#### Files:
- `src/components/government/AtomicGovernmentDashboard.tsx:52`
- `src/components/diplomatic/AdvancedSearchDiscovery.tsx:139, 181`
- `src/components/countries/DiplomaticIntelligenceProfile.tsx:123`
- `src/lib/preview-seeder.ts:114, 313`

These are intentionally disabled pending:
- Atomic government router implementation
- Achievements system implementation
- User-based ThinkPages refactor
- Mock data generator availability

**Tracking:** Add to v1.2 roadmap when dependencies are resolved.

---

## Tracking & Management

### GitHub Issue Creation

For each HIGH and MEDIUM priority item, create a GitHub issue with:
```markdown
Title: [Type Safety] Define ThinkShare ClientState Interface
Labels: type-safety, technical-debt, priority-high
Milestone: v1.1.1

**Description:**
Replace `any` types in ThinkShare components with proper TypeScript interfaces.

**Files Affected:**
- src/components/thinkshare/ConversationListContent.tsx:52
- src/components/thinkshare/MessageList.tsx:45
- src/components/thinkshare/ConversationCard.tsx:51
- src/components/thinkshare/ConversationList.tsx:53

**Estimated Effort:** 2-3 hours

**Acceptance Criteria:**
- [ ] Create ThinkShareClientState interface
- [ ] Create ConversationState interface
- [ ] Replace all any types
- [ ] Verify no type errors
- [ ] Test ThinkShare functionality
```

### Sprint Planning

**v1.1.1 Sprint (Current):**
- [ ] Items 1-5 (HIGH priority type safety)
- Effort: 4-6 hours
- Owner: TBD

**v1.1.2 Sprint (Next):**
- [ ] Items 6-8 (MEDIUM priority data model)
- Effort: 8-11 hours
- Owner: TBD

**v1.2.0 Sprint (Future):**
- [ ] Items 9-16 (LOW priority features)
- Effort: 20-28 hours
- Owner: TBD

---

## Review Schedule

- **Weekly:** Review new TODOs added to codebase
- **Monthly:** Update priorities based on product roadmap
- **Quarterly:** Audit for stale TODOs and mark for removal
- **Release:** Ensure no HIGH priority TODOs remain

---

## Appendix: TODO Guidelines

### Adding New TODOs

When adding TODOs to code, use this format:
```typescript
// TODO(priority: HIGH | MEDIUM | LOW): Description
// Effort: X hours
// Blocking: Yes/No
// Context: Additional information
```

Example:
```typescript
// TODO(priority: HIGH): Replace any type with proper interface
// Effort: 1 hour
// Blocking: No
// Context: Breaks type safety in parent components
clientState: any;
```

### When to Add vs. Fix

**Add TODO if:**
- Fix requires >30 minutes
- Fix requires architectural decision
- Fix depends on other incomplete work
- Fix is enhancement, not bug

**Fix immediately if:**
- Fix takes <30 minutes
- Fix is critical bug
- Fix prevents deployment
- Fix improves security

---

**Document Maintained By:** Engineering Team
**Last Review:** 2025-10-16
**Next Review:** 2025-10-23
