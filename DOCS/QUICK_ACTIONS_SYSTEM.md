# Quick Actions System Documentation

## Overview

The Quick Actions System is a comprehensive integrated platform within IxStats that provides streamlined access to government operations, policy management, meeting scheduling, and activity planning. It synchronizes with the IxTime system, government structure, and economic subsystems to provide a cohesive experience for managing your country.

## Architecture

### Database Models

The Quick Actions system consists of the following interconnected models:

#### 1. **GovernmentOfficial**
Represents government officials, ministers, and advisors.

**Fields:**
- `name`: Official's full name
- `title`: Position title (e.g., "Minister of Defense")
- `role`: Role category (Cabinet Member, Department Head, Advisor, Staff, External Consultant)
- `governmentStructureId`: Link to government structure
- `departmentId`: Optional link to specific department
- `email`, `phone`, `bio`, `photoUrl`: Contact and profile information
- `appointedDate`, `termEndDate`: Term tracking
- `responsibilities`: JSON array of responsibilities
- `priority`: Display/sorting priority (0-100)
- `isActive`: Whether the official is currently active

**Relations:**
- Belongs to `GovernmentStructure`
- May belong to `GovernmentDepartment`
- Has many `MeetingAttendance` records

#### 2. **CabinetMeeting**
Represents scheduled government meetings.

**Fields:**
- `title`, `description`: Meeting identification
- `scheduledDate`: Real-world DateTime
- `scheduledIxTime`: Corresponding IxTime timestamp
- `duration`: Meeting length in minutes
- `location`: Physical or virtual location
- `meetingType`: "in_person", "virtual", or "hybrid"
- `status`: "scheduled", "in_progress", "completed", "cancelled"
- `notes`: Meeting minutes/notes
- `decisions`: JSON array of decisions made
- `actionItems`: JSON array of follow-up tasks

**Relations:**
- Has many `MeetingAttendance` records
- Has many `MeetingAgendaItem` records
- Linked to `ActivitySchedule` for calendar integration

#### 3. **MeetingAttendance**
Tracks who attends meetings.

**Fields:**
- `meetingId`: Link to meeting
- `officialId`: Optional link to GovernmentOfficial
- `attendeeName`: Name (if not an official)
- `attendeeRole`: Role/title
- `attendanceStatus`: "invited", "confirmed", "attended", "declined", "absent"
- `notes`: Attendance-specific notes

#### 4. **MeetingAgendaItem**
Individual agenda topics for meetings.

**Fields:**
- `meetingId`: Parent meeting
- `title`, `description`: Agenda item details
- `order`: Display order
- `duration`: Estimated duration in minutes
- `category`: Link to subsystem (e.g., "economic", "social")
- `tags`: JSON array of tags for filtering
- `relatedMetrics`: JSON object linking to specific country stats/metrics
- `presenter`: Who will present this item
- `status`: "pending", "discussed", "deferred", "completed"
- `outcome`: Result/decision from discussion

**Integration:** Agenda items can be tagged and categorized to pull data from economic, government, or diplomatic subsystems.

#### 5. **Policy**
Represents government policies with economic effects.

**Fields:**
- `name`, `description`: Policy identification
- `policyType`: "economic", "social", "diplomatic", "infrastructure", "governance"
- `category`: Specific category within type
- `status`: "draft", "proposed", "active", "expired", "repealed"
- `priority`: "critical", "high", "medium", "low"
- `objectives`: JSON array of policy objectives
- `targetMetrics`: JSON object of metrics this policy affects
- `implementationCost`, `maintenanceCost`: Financial costs
- `estimatedBenefit`: Description of expected benefits
- `proposedDate`, `effectiveDate`, `expiryDate`: Timing (real-world)
- `proposedIxTime`, `effectiveIxTime`: Timing (IxTime)
- **Economic Effects:**
  - `gdpEffect`: GDP impact (percentage)
  - `employmentEffect`: Employment impact (percentage)
  - `inflationEffect`: Inflation impact (percentage)
  - `taxRevenueEffect`: Tax revenue impact (percentage)
  - `customEffects`: JSON object of custom effects
- `approvalRequired`, `approvedBy`, `approvedDate`: Approval workflow
- `reviewNotes`: Review comments

**Relations:**
- Has many `PolicyEffectLog` records tracking actual effects over time

#### 6. **PolicyEffectLog**
Tracks the application and effects of policies.

**Fields:**
- `policyId`: Parent policy
- `appliedAt`: Real-world timestamp
- `appliedIxTime`: IxTime timestamp
- `effectType`: "initial", "periodic", or "final"
- `metricsBefore`: JSON snapshot of metrics before effect
- `metricsAfter`: JSON snapshot of metrics after effect
- `actualEffect`: JSON object of actual changes observed
- `notes`: Additional notes

**Purpose:** Provides historical tracking of policy effects for analysis and reporting.

#### 7. **ActivitySchedule**
Universal activity scheduler for all types of activities.

**Fields:**
- `activityType`: "meeting", "policy_review", "economic_review", "diplomatic_event", "custom"
- `title`, `description`: Activity details
- `scheduledDate`: Real-world DateTime
- `scheduledIxTime`: IxTime timestamp
- `duration`: Duration in minutes
- `status`: "scheduled", "in_progress", "completed", "cancelled"
- `priority`: "urgent", "high", "normal", "low"
- `category`: Optional categorization
- `tags`: JSON array of tags
- `relatedIds`: JSON object linking to related records (meetings, policies, etc.)
- `recurrence`: JSON object for recurring activities
- `reminderSettings`: JSON object for reminder configuration
- `completionNotes`: Notes after completion

**Purpose:** Unified calendar/planner view integrating all types of activities.

#### 8. **QuickActionTemplate**
Reusable templates for common quick actions.

**Fields:**
- `name`: Template name
- `actionType`: Type of action
- `category`: Categorization
- `description`: What this template does
- `defaultSettings`: JSON object with default settings
- `requiredFields`, `optionalFields`: JSON arrays defining fields
- `estimatedDuration`: Time estimate
- `recommendedFor`: JSON array of conditions for recommendations
- `isActive`: Whether template is available

## API Endpoints (tRPC)

### Government Officials

#### `getOfficials`
```typescript
input: {
  countryId: string;
  governmentStructureId?: string;
  departmentId?: string;
  role?: string;
  activeOnly?: boolean; // default: true
}
output: GovernmentOfficial[]
```
Retrieves government officials with optional filtering.

#### `createOfficial`
```typescript
input: {
  countryId: string;
  official: GovernmentOfficialInput;
}
output: GovernmentOfficial
```
Creates a new government official.

#### `updateOfficial`
```typescript
input: {
  officialId: string;
  updates: Partial<GovernmentOfficialInput>;
}
output: GovernmentOfficial
```
Updates an existing official's information.

#### `deleteOfficial`
```typescript
input: {
  officialId: string;
  hardDelete?: boolean; // default: false (soft delete)
}
output: { success: boolean }
```
Deletes (or deactivates) a government official.

### Cabinet Meetings

#### `getMeetings`
```typescript
input: {
  countryId: string;
  userId?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  fromDate?: Date;
  toDate?: Date;
  limit?: number; // default: 50, max: 100
}
output: CabinetMeeting[] // with attendances and agenda items
```
Retrieves meetings with optional filtering.

#### `createMeeting`
```typescript
input: {
  countryId: string;
  userId: string;
  meeting: {
    title: string;
    description?: string;
    scheduledDate: Date;
    duration?: number; // minutes, default: 60
    location?: string;
    meetingType?: 'in_person' | 'virtual' | 'hybrid';
    attendeeIds?: string[]; // GovernmentOfficial IDs
    customAttendees?: Array<{ name: string; role?: string }>;
    agendaItems?: Array<AgendaItemInput>;
  }
}
output: { meeting: CabinetMeeting; success: boolean; message: string }
```
Creates a new cabinet meeting with:
- Automatic IxTime sync
- Attendee tracking (both officials and custom attendees)
- Agenda item creation
- Activity schedule integration

#### `updateMeeting`
```typescript
input: {
  meetingId: string;
  updates: {
    status?: MeetingStatus;
    notes?: string;
    decisions?: string[];
    actionItems?: Array<ActionItem>;
  }
}
output: { meeting: CabinetMeeting; success: boolean }
```
Updates meeting status, adds notes, records decisions and action items.

#### `updateAgendaItem`
```typescript
input: {
  agendaItemId: string;
  status: 'pending' | 'discussed' | 'deferred' | 'completed';
  outcome?: string;
}
output: { agendaItem: MeetingAgendaItem; success: boolean }
```
Updates individual agenda item status and outcome.

### Policies

#### `getPolicies`
```typescript
input: {
  countryId: string;
  userId?: string;
  policyType?: PolicyType;
  status?: PolicyStatus;
  activeOnly?: boolean;
  limit?: number; // default: 50, max: 100
}
output: Policy[] // with effect logs
```
Retrieves policies with optional filtering.

#### `createPolicy`
```typescript
input: {
  countryId: string;
  userId: string;
  policy: PolicyInput;
}
output: { policy: Policy; success: boolean; message: string }
```
Creates a new policy with:
- Automatic IxTime tracking
- Initial metrics snapshot
- Effect log creation
- Economic integration ready

#### `activatePolicy`
```typescript
input: {
  policyId: string;
  applyEffects?: boolean; // default: true
}
output: {
  success: boolean;
  message: string;
  effectSummary?: {
    gdpPerCapitaChange: number;
    unemploymentRateChange: number;
    inflationRateChange: number;
    taxRevenueChange: number;
  }
}
```
Activates a policy and applies its economic effects to the country.

**Effect Application:**
- Updates country GDP, employment, inflation, and tax revenue
- Creates detailed effect log with before/after snapshots
- Returns summary of actual changes

#### `updatePolicy`
```typescript
input: {
  policyId: string;
  updates: Partial<PolicyInput> & { status?: PolicyStatus };
}
output: { policy: Policy; success: boolean }
```
Updates policy information and status.

### Activity Schedule

#### `getActivitySchedule`
```typescript
input: {
  countryId: string;
  userId?: string;
  fromDate: Date;
  toDate: Date;
  activityType?: ActivityType;
  status?: ActivityStatus;
}
output: ActivitySchedule[]
```
Retrieves activities for planner/calendar view.

#### `createActivity`
```typescript
input: {
  countryId: string;
  userId: string;
  activity: ActivityScheduleInput;
}
output: { activity: ActivitySchedule; success: boolean }
```
Creates a scheduled activity with IxTime sync.

#### `getUpcomingActivities`
```typescript
input: {
  countryId: string;
  userId?: string;
  days?: number; // default: 7, max: 30
}
output: ActivitySchedule[]
```
Quick view of upcoming activities for the next N days.

### Dashboard Overview

#### `getDashboardOverview`
```typescript
input: {
  countryId: string;
  userId: string;
}
output: {
  upcomingMeetings: CabinetMeeting[]; // next 7 days, limit 5
  activePolicies: Policy[]; // active policies, limit 5
  upcomingActivities: ActivitySchedule[]; // next 7 days, limit 10
  officialsCount: number;
  stats: {
    totalMeetingsThisWeek: number;
    activePoliciesCount: number;
    upcomingActivitiesCount: number;
  }
}
```
Comprehensive dashboard overview for Quick Actions panel.

## Integration Points

### IxTime Integration

All time-sensitive records (meetings, policies, activities) store both:
- **Real-world time** (`scheduledDate`, `effectiveDate`, etc.)
- **IxTime timestamp** (`scheduledIxTime`, `effectiveIxTime`, etc.)

This dual tracking enables:
- Synchronization with the IxStats time system
- Historical playback and time travel features
- Accurate scheduling in game time

**Example:**
```typescript
const meeting = await createMeeting({
  scheduledDate: new Date('2025-02-15T10:00:00Z'), // Real time
  // Automatically calculates scheduledIxTime using IxTime.convertToIxTime()
});
```

### Government Structure Integration

Quick Actions directly integrates with the Government system:
- Officials belong to departments and government structures
- Meetings can auto-populate with cabinet members
- Agenda items can reference government metrics/KPIs
- Departments provide organizational context

**Example:**
```typescript
// Get all cabinet members for a meeting
const officials = await getOfficials({
  countryId: 'xxx',
  role: 'Cabinet Member',
  activeOnly: true
});

// Create meeting with all cabinet members
await createMeeting({
  attendeeIds: officials.map(o => o.id)
});
```

### Economic System Integration

Policies directly affect country economics:
- GDP impact tracking
- Employment/unemployment effects
- Inflation rate changes
- Tax revenue modifications
- Custom effects for specialized metrics

**Effect Application Flow:**
1. Policy created with defined economic effects (percentages)
2. Before activation, current country metrics are snapshot
3. On activation, effects are calculated and applied to country
4. After metrics are snapshot
5. Effect log records the full change for historical analysis

**Example:**
```typescript
const policy = await createPolicy({
  name: "Economic Stimulus Package",
  policyType: "economic",
  gdpEffect: 2.5,        // +2.5% GDP
  employmentEffect: -5.0, // -5% unemployment (improvement)
  implementationCost: 50000000,
});

// Later, activate and apply effects
const result = await activatePolicy({
  policyId: policy.id,
  applyEffects: true
});

console.log(result.effectSummary);
// {
//   gdpPerCapitaChange: +1250,
//   unemploymentRateChange: -0.25,
//   inflationRateChange: 0,
//   taxRevenueChange: +0.5
// }
```

### Agenda Item Tagging and Filtering

Agenda items support advanced categorization:

**Categories:**
- `economic`: Links to economic data/metrics
- `social`: Social policy items
- `diplomatic`: Foreign relations
- `infrastructure`: Infrastructure projects
- `governance`: Government structure/operations

**Tags:**
Array of custom tags for flexible filtering:
```json
["budget", "defense", "Q1-2040", "urgent"]
```

**Related Metrics:**
JSON object linking to specific metrics:
```json
{
  "gdp": true,
  "unemployment": true,
  "departmentId": "dept_12345",
  "metricPath": "economy.fiscal.taxRevenue"
}
```

**UI Integration:**
- Filter agenda items by category
- Search by tags
- Auto-populate agenda with items based on current metrics
- Show real-time metric values in agenda view

## UI Components

### MeetingScheduler Component

**Location:** `/src/components/quickactions/MeetingScheduler.tsx`

**Features:**
- Government official selection with autocomplete
- IxTime date/time picker with dual display (real + IxTime)
- Agenda item builder with category/tag support
- Meeting type selection (in-person/virtual/hybrid)
- Duration and location management
- Live preview of selected attendees

**Props:**
```typescript
interface MeetingSchedulerProps {
  countryId: string;
  userId: string;
  onSuccess?: (meeting: CabinetMeeting) => void;
  defaultDate?: Date;
  defaultOfficials?: string[]; // Pre-select officials
}
```

### PolicyCreator Component

**Location:** `/src/components/quickactions/PolicyCreator.tsx`

**Features:**
- Policy type and category selection
- Economic effect sliders with real-time impact preview
- Objectives and target metrics builder
- Cost estimation calculator
- Effective date/time with IxTime sync
- Approval workflow support
- Effect simulation before activation

**Props:**
```typescript
interface PolicyCreatorProps {
  countryId: string;
  userId: string;
  onSuccess?: (policy: Policy) => void;
  presetType?: PolicyType;
  economicData?: EconomyData; // For impact preview
}
```

### ActivityPlanner Component

**Location:** `/src/components/quickactions/ActivityPlanner.tsx`

**Features:**
- Calendar view (day/week/month)
- Unified view of meetings, policies, and activities
- IxTime timeline overlay
- Drag-and-drop rescheduling
- Color-coded by activity type and priority
- Quick filters and search
- Recurring activity support

**Props:**
```typescript
interface ActivityPlannerProps {
  countryId: string;
  userId: string;
  defaultView?: 'day' | 'week' | 'month';
  showIxTime?: boolean;
}
```

### QuickActionsPanel Component

**Location:** `/src/components/quickactions/QuickActionsPanel.tsx`

**Features:**
- Dashboard overview widget
- Quick shortcuts to common actions
- Upcoming items summary
- Recent activity feed
- Integration with Executive Command Center

**Props:**
```typescript
interface QuickActionsPanelProps {
  countryId: string;
  userId: string;
  variant?: 'compact' | 'full';
  showMeetings?: boolean;
  showPolicies?: boolean;
  showActivities?: boolean;
}
```

## Usage Examples

### Schedule a Cabinet Meeting

```typescript
import { api } from "~/trpc/react";

const CreateMeetingExample = () => {
  const createMeeting = api.quickActions.createMeeting.useMutation({
    onSuccess: (result) => {
      console.log("Meeting created:", result.meeting);
      toast.success(result.message);
    }
  });

  const handleSchedule = () => {
    createMeeting.mutate({
      countryId: "country_123",
      userId: "user_456",
      meeting: {
        title: "Weekly Cabinet Meeting",
        description: "Review economic policies and budget",
        scheduledDate: new Date("2025-02-15T10:00:00Z"),
        duration: 120,
        meetingType: "hybrid",
        location: "Cabinet Room / Zoom",
        attendeeIds: ["official_1", "official_2"], // Government officials
        customAttendees: [
          { name: "External Advisor", role: "Economic Consultant" }
        ],
        agendaItems: [
          {
            title: "Q1 Budget Review",
            description: "Review Q1 spending and projections",
            duration: 30,
            category: "economic",
            tags: ["budget", "Q1"],
            presenter: "Minister of Finance"
          },
          {
            title: "Infrastructure Projects Update",
            duration: 45,
            category: "infrastructure",
            tags: ["infrastructure", "capital-projects"]
          }
        ]
      }
    });
  };

  return <Button onClick={handleSchedule}>Schedule Meeting</Button>;
};
```

### Create and Activate a Policy

```typescript
const PolicyExample = () => {
  const createPolicy = api.quickActions.createPolicy.useMutation();
  const activatePolicy = api.quickActions.activatePolicy.useMutation();

  const handleCreateAndActivate = async () => {
    // Step 1: Create policy
    const policyResult = await createPolicy.mutateAsync({
      countryId: "country_123",
      userId: "user_456",
      policy: {
        name: "Green Energy Incentive Program",
        description: "Tax incentives for renewable energy adoption",
        policyType: "economic",
        category: "environmental",
        priority: "high",
        objectives: [
          "Reduce carbon emissions by 20%",
          "Increase renewable energy capacity",
          "Create green jobs"
        ],
        implementationCost: 100000000,
        maintenanceCost: 5000000,
        estimatedBenefit: "15000 new jobs, 25% emissions reduction",
        effectiveDate: new Date("2025-03-01"),
        gdpEffect: 1.5,          // +1.5% GDP
        employmentEffect: -3.0,   // -3% unemployment (improvement)
        inflationEffect: 0.2,     // +0.2% inflation
        taxRevenueEffect: -2.0,   // -2% tax revenue (due to incentives)
        customEffects: {
          carbonEmissions: -20,   // -20% emissions
          renewableCapacity: 35   // +35% renewable capacity
        }
      }
    });

    // Step 2: Activate and apply effects
    const activationResult = await activatePolicy.mutateAsync({
      policyId: policyResult.policy.id,
      applyEffects: true
    });

    console.log("Policy effects:", activationResult.effectSummary);
    toast.success(`Policy activated! GDP +${activationResult.effectSummary.gdpPerCapitaChange}`);
  };

  return <Button onClick={handleCreateAndActivate}>Create & Activate Policy</Button>;
};
```

### Dashboard Overview

```typescript
const QuickActionsDashboard = ({ countryId, userId }: Props) => {
  const { data, isLoading } = api.quickActions.getDashboardOverview.useQuery({
    countryId,
    userId
  });

  if (isLoading) return <Skeleton />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>
            {data.stats.totalMeetingsThisWeek} meetings this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcomingMeetings.map(meeting => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </CardContent>
      </Card>

      {/* Active Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Active Policies</CardTitle>
          <CardDescription>
            {data.stats.activePoliciesCount} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.activePolicies.map(policy => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Activities</CardTitle>
          <CardDescription>
            {data.stats.upcomingActivitiesCount} scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcomingActivities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
```

## Best Practices

### 1. Always Use IxTime for Scheduling
```typescript
// ✅ Good: Store both times
const scheduledDate = new Date("2025-02-15T10:00:00Z");
const scheduledIxTime = IxTime.convertToIxTime(scheduledDate.getTime());

// ❌ Bad: Only store real-world time
const scheduledDate = new Date("2025-02-15T10:00:00Z");
```

### 2. Track Policy Effects
```typescript
// ✅ Good: Enable effect tracking
await activatePolicy({ policyId, applyEffects: true });

// Use effect logs for analysis
const logs = await getPolicies({ countryId });
logs[0].policyEffectLog.forEach(log => {
  console.log("Effect:", log.actualEffect);
});
```

### 3. Organize Agenda Items
```typescript
// ✅ Good: Use categories and tags
agendaItems: [
  {
    title: "Budget Review",
    category: "economic",
    tags: ["budget", "quarterly", "finance"],
    relatedMetrics: { gdp: true, taxRevenue: true }
  }
]

// ❌ Bad: No organization
agendaItems: [{ title: "Budget Review" }]
```

### 4. Use Government Official Relations
```typescript
// ✅ Good: Link to officials for auto-population
const officials = await getOfficials({
  countryId,
  role: "Cabinet Member"
});

await createMeeting({
  attendeeIds: officials.map(o => o.id)
});

// ❌ Bad: Manual name entry
customAttendees: [
  { name: "John Doe" },
  { name: "Jane Smith" }
]
```

### 5. Provide Detailed Policy Information
```typescript
// ✅ Good: Comprehensive policy data
{
  name: "Policy Name",
  description: "Detailed description...",
  objectives: ["Objective 1", "Objective 2"],
  targetMetrics: { gdp: true, employment: true },
  gdpEffect: 2.5,
  employmentEffect: -5.0,
  estimatedBenefit: "Expected outcomes..."
}

// ❌ Bad: Minimal data
{
  name: "New Policy",
  description: "TBD"
}
```

## Troubleshooting

### Issue: Meetings Not Showing in Calendar
**Solution:** Ensure `scheduledIxTime` is being set correctly:
```typescript
const meeting = await createMeeting({
  ...data,
  scheduledDate: new Date(dateString)
  // scheduledIxTime is auto-calculated
});
```

### Issue: Policy Effects Not Applying
**Solution:** Check that `applyEffects: true` is set:
```typescript
await activatePolicy({
  policyId,
  applyEffects: true  // ← Must be true
});
```

### Issue: Government Officials Not Loading
**Solution:** Verify government structure exists for country:
```typescript
const govStructure = await government.getByCountryId({ countryId });
if (!govStructure) {
  // Create government structure first
}
```

## Future Enhancements

Planned features for future releases:

1. **AI-Powered Recommendations**
   - Smart agenda item suggestions based on current metrics
   - Policy recommendations based on economic conditions
   - Optimal meeting scheduling

2. **Advanced Recurrence**
   - Complex recurrence patterns for meetings
   - Automatic policy review reminders
   - Recurring activity templates

3. **Collaborative Features**
   - Shared calendars between countries
   - Policy co-authoring
   - Multi-country meetings

4. **Analytics Dashboard**
   - Policy effectiveness analysis
   - Meeting productivity metrics
   - Official performance tracking

5. **Mobile Optimization**
   - Mobile-first quick actions interface
   - Push notifications for upcoming activities
   - Quick policy activation from mobile

6. **Integration Expansion**
   - Link to diplomatic relations system
   - Integration with economic forecasting
   - Automatic activity suggestions based on intelligence briefings

## Support

For issues, questions, or feature requests related to the Quick Actions system, please refer to:
- Main IxStats documentation: `/DOCS/`
- Government system docs: `/DOCS/GOVERNMENT_SYSTEM.md`
- IxTime documentation: `/DOCS/IXTIME_SYSTEM.md`
- API reference: `/DOCS/API_REFERENCE.md`
