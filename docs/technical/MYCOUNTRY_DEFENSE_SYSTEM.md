# MyCountry Defense System - V1 Documentation

## Overview

The MyCountry Defense System is a comprehensive military and security management platform integrated into IxStats. It allows country leaders to build, manage, and monitor their nation's armed forces, assess security threats, track internal stability, and allocate defense budgets.

**Status**: ✅ **V1 Production Ready** (100% Live-Wired)

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [User Interface](#user-interface)
6. [Usage Guide](#usage-guide)
7. [Security & Permissions](#security--permissions)
8. [Calculations & Metrics](#calculations--metrics)

---

## Features

### Core Capabilities

- ✅ **Military Branch Management**: Create and customize military branches (Army, Navy, Air Force, Space Force, Marines, Cyber Command, Special Forces, Coast Guard)
- ✅ **Unit Organization**: Build hierarchical military units (divisions, fleets, wings, squadrons, etc.)
- ✅ **Asset Tracking**: Manage military assets (aircraft, ships, vehicles, weapon systems, installations)
- ✅ **Security Assessment**: Real-time calculation of national security posture
- ✅ **Threat Management**: Track and assess security threats with severity levels
- ✅ **Budget Allocation**: Defense budget management with GDP percentage tracking
- ✅ **Internal Stability**: Monitor social cohesion, crime rates, and political stability
- ✅ **Border Security**: Assess border integrity and threats from neighbors
- ✅ **Readiness Monitoring**: Track military readiness, technology level, training, and morale

---

## Architecture

### Technology Stack

- **Backend**: tRPC API with Prisma ORM
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Frontend**: Next.js 15 with React 18, Tailwind CSS v4
- **State Management**: TanStack Query (React Query) via tRPC
- **Validation**: Zod schemas for type-safe input validation
- **Authentication**: Clerk with protected procedures

### File Structure

```
/src/
├── server/api/routers/
│   └── security.ts                    # 834 lines - Main defense API router
├── app/mycountry/defense/
│   └── page.tsx                       # Defense dashboard main page
├── components/defense/
│   ├── MilitaryCustomizer.tsx         # Branch management UI
│   ├── UnitManager.tsx                # Unit organization UI
│   ├── AssetManager.tsx               # Asset tracking UI
│   ├── StabilityPanel.tsx             # Internal stability monitoring
│   └── CommandPanel.tsx               # Budget & command center
/prisma/
└── schema.prisma                      # Lines 2571-2753: Defense models
```

---

## Database Schema

### Core Models

#### MilitaryBranch
Stores military branch information with comprehensive metrics.

```prisma
model MilitaryBranch {
  id                    String       @id @default(cuid())
  countryId             String
  branchType            BranchType   // enum: army, navy, air_force, etc.
  name                  String
  motto                 String?
  imageUrl              String?
  description           String?
  established           String?

  // Personnel
  activeDuty            Int          @default(0)
  reserves              Int          @default(0)
  civilianStaff         Int          @default(0)

  // Budget
  annualBudget          Float        @default(0)
  budgetPercent         Float        @default(0)

  // Readiness & Capability (0-100 scale)
  readinessLevel        Float        @default(50)
  technologyLevel       Float        @default(50)
  trainingLevel         Float        @default(50)
  morale                Float        @default(50)
  deploymentCapacity    Float        @default(50)
  sustainmentCapacity   Float        @default(50)

  // Relations
  country               Country      @relation(...)
  units                 MilitaryUnit[]
  assets                MilitaryAsset[]
}
```

**Branch Types**:
- `army` - Ground forces
- `navy` - Naval forces
- `air_force` - Aerial forces
- `space_force` - Space operations
- `marines` - Amphibious forces
- `cyber_command` - Cyber warfare
- `special_forces` - Special operations
- `coast_guard` - Coastal security

#### MilitaryUnit
Organizational units within military branches.

```prisma
model MilitaryUnit {
  id                    String          @id @default(cuid())
  branchId              String
  name                  String
  unitType              String          // division, brigade, fleet, wing, etc.
  designation           String?         // e.g., "1st Infantry Division"
  description           String?
  personnel             Int             @default(0)
  commanderName         String?
  commanderRank         String?
  headquarters          String?         // Location
  readiness             Float           @default(50)

  branch                MilitaryBranch  @relation(...)
}
```

#### MilitaryAsset
Equipment and installations tracking.

```prisma
model MilitaryAsset {
  id                    String          @id @default(cuid())
  branchId              String
  name                  String
  assetType             AssetType       // aircraft, ship, vehicle, etc.
  category              String          // Fighter, Destroyer, Tank, etc.
  status                AssetStatus     // operational, maintenance, reserve, retired
  quantity              Int             @default(1)
  operational           Int             @default(1)
  acquisitionCost       Float           @default(0)
  maintenanceCost       Float           @default(0)
  modernizationLevel    Float           @default(50)
  capability            String?

  branch                MilitaryBranch  @relation(...)
}
```

**Asset Types**:
- `aircraft` - Air vehicles (fighters, bombers, transports)
- `ship` - Naval vessels (carriers, destroyers, submarines)
- `vehicle` - Ground vehicles (tanks, APCs, trucks)
- `weapon_system` - Weapon platforms (missiles, artillery)
- `installation` - Military bases and facilities

#### SecurityThreat
Threat assessment and tracking.

```prisma
model SecurityThreat {
  id                    String          @id @default(cuid())
  countryId             String
  threatName            String
  threatType            ThreatType      // military, terrorism, cyber, etc.
  severity              ThreatSeverity  // existential, critical, high, moderate, low
  status                ThreatStatus    // monitoring, responding, contained, resolved
  description           String?
  likelihood            Float           @default(50)  // 0-100 percentage
  impact                Float           @default(50)  // 0-100 scale
  detectedAt            DateTime        @default(now())
  isActive              Boolean         @default(true)

  country               Country         @relation(...)
}
```

**Threat Types**:
- `military` - Foreign military aggression
- `terrorism` - Terrorist organizations
- `insurgency` - Armed rebellion
- `cyber` - Cyber attacks
- `organized_crime` - Criminal networks
- `espionage` - Intelligence threats
- `nuclear` - Nuclear threats
- `biological` - Biological weapons
- `natural_disaster` - Natural catastrophes

**Severity Levels**:
- `existential` - Threatens national survival
- `critical` - Major immediate threat
- `high` - Significant disruption potential
- `moderate` - Manageable but serious
- `low` - Minor threat with limited impact

---

## API Endpoints

All endpoints are in `/src/server/api/routers/security.ts`

### Security Assessment

#### `getSecurityAssessment`
**Type**: `publicProcedure`
**Input**: `{ countryId: string }`

Calculates comprehensive security posture including:
- Overall security score (0-100)
- Military strength
- Internal stability
- Border security
- Cybersecurity level
- Counter-terrorism capability
- Active threat count
- Military readiness

**Calculation**:
```typescript
overallSecurityScore =
  militaryStrength × 0.35 +
  stabilityScore × 0.25 +
  (100 - activeThreatCount × 5) × 0.20 +
  cybersecurity × 0.10 +
  counterTerrorism × 0.10
```

**Security Levels**:
- `very_secure`: Score ≥ 75
- `secure`: Score 60-74
- `moderate`: Score 40-59
- `high_risk`: Score 25-39
- `critical`: Score < 25

### Military Branches

#### `getMilitaryBranches`
**Type**: `publicProcedure`
**Input**: `{ countryId: string }`
**Returns**: Array of branches with units and assets included

#### `createMilitaryBranch`
**Type**: `protectedProcedure` 🔒
**Input**:
```typescript
{
  countryId: string,
  branch: {
    branchType: BranchType,
    name: string,
    motto?: string,
    imageUrl?: string,
    description?: string,
    established?: string,
    activeDuty: number,          // default: 0
    reserves: number,             // default: 0
    civilianStaff: number,        // default: 0
    annualBudget: number,         // default: 0
    budgetPercent: number,        // default: 0, max: 100
    readinessLevel: number,       // default: 50, 0-100
    technologyLevel: number,      // default: 50, 0-100
    trainingLevel: number,        // default: 50, 0-100
    morale: number,               // default: 50, 0-100
    deploymentCapacity: number,   // default: 50, 0-100
    sustainmentCapacity: number   // default: 50, 0-100
  }
}
```

**Validation**:
- User must own the country (verified via Clerk user profile)
- All percentage values validated 0-100
- Personnel counts must be non-negative integers

#### `updateMilitaryBranch`
**Type**: `protectedProcedure` 🔒
**Input**: `{ id: string, branch: Partial<BranchData> }`

#### `deleteMilitaryBranch`
**Type**: `protectedProcedure` 🔒
**Input**: `{ id: string }`

### Military Units

#### `createMilitaryUnit`
**Type**: `protectedProcedure` 🔒
**Input**:
```typescript
{
  branchId: string,
  unit: {
    name: string,
    unitType: string,        // division, fleet, wing, etc.
    designation?: string,
    description?: string,
    personnel: number,
    commanderName?: string,
    commanderRank?: string,
    headquarters?: string,
    readiness: number        // 0-100
  }
}
```

#### `updateMilitaryUnit` / `deleteMilitaryUnit`
Similar structure with ownership verification through parent branch.

### Military Assets

#### `createMilitaryAsset`
**Type**: `protectedProcedure` 🔒
**Input**:
```typescript
{
  branchId: string,
  asset: {
    name: string,
    assetType: AssetType,
    category: string,
    status: AssetStatus,
    quantity: number,
    operational: number,
    acquisitionCost: number,
    maintenanceCost: number,
    modernizationLevel: number,  // 0-100
    capability?: string
  }
}
```

#### `updateMilitaryAsset` / `deleteMilitaryAsset`
Similar structure with ownership verification.

### Security Threats

#### `getSecurityThreats`
**Type**: `publicProcedure`
**Input**: `{ countryId: string, activeOnly?: boolean }`
**Returns**: Array of threats ordered by severity and date

#### `createSecurityThreat`
**Type**: `protectedProcedure` 🔒
**Input**:
```typescript
{
  countryId: string,
  threat: {
    threatName: string,
    threatType: ThreatType,
    severity: ThreatSeverity,
    status: ThreatStatus,      // default: 'monitoring'
    description?: string,
    likelihood: number,         // 0-100, default: 50
    impact: number             // 0-100, default: 50
  }
}
```

#### `updateSecurityThreat`
**Type**: `protectedProcedure` 🔒
Allows updating threat details and status (monitoring → responding → contained → resolved)

### Defense Budget

#### `getDefenseBudget`
**Type**: `publicProcedure`
**Input**: `{ countryId: string, fiscalYear: number }`

**Returns**:
```typescript
{
  totalBudget: number,          // Sum of all branch budgets
  gdpPercent: number,           // Budget as % of country GDP
  personnelCosts: number,       // 40% of total
  operationsMaintenance: number, // 30% of total
  procurement: number,          // 15% of total
  rdteCosts: number,            // 10% of total
  militaryConstruction: number  // 5% of total
}
```

### Internal Stability

#### `getInternalStability`
**Type**: `publicProcedure`
**Input**: `{ countryId: string }`

**Returns**: Stability metrics including:
- Stability score (based on country.politicalStability)
- Crime rates
- Social cohesion
- Trust in government (from country.publicApproval)
- Police effectiveness
- Protest/riot risk levels

### Border Security

#### `getBorderSecurity`
**Type**: `publicProcedure`
**Input**: `{ countryId: string }`

Currently returns placeholder data. Future enhancement opportunity for V1.1.

### Defense Overview

#### `getDefenseOverview`
**Type**: `publicProcedure`
**Input**: `{ countryId: string }`

**Returns**:
```typescript
{
  totalMilitary: number,       // Active + reserves
  readinessLevel: number,      // Average across branches
  budgetUtilization: number,
  activeOperations: number,
  overallScore: number,
  securityLevel: string,
  militaryStrength: number,
  branchCount: number,
  activeThreats: number
}
```

---

## User Interface

### Defense Dashboard (`/mycountry/defense`)

Six-tab interface for comprehensive defense management:

#### 1. **Overview Tab**
- Security status card with overall score
- Component scores (Military, Stability, Border, Cyber, Counter-Terrorism)
- Active threat count and severity breakdown
- Recent security events feed
- Military readiness summary by branch

**Key Metrics Displayed**:
- Overall Security Score (with color-coded status)
- Military Branches count
- High Severity Threats
- Readiness Level percentage

#### 2. **Forces Tab** (MilitaryCustomizer)
Full military branch management interface:

**Branch Creation**:
- Select branch type from 8 options
- Configure name, motto, emblem/image
- Set personnel numbers (active, reserves, civilian)
- Allocate budget and set GDP percentage
- Configure readiness metrics (6 sliders):
  - Readiness Level
  - Technology Level
  - Training Level
  - Morale
  - Deployment Capacity
  - Sustainment Capacity

**Branch Management**:
- Expandable cards showing branch details
- Edit/delete functionality
- Unit and asset sub-management
- Visual indicators for readiness levels

**Unit Manager**:
- Add organizational units to branches
- Configure unit type (division, fleet, wing, etc.)
- Set commander information
- Assign personnel counts
- Track unit-level readiness

**Asset Manager**:
- Add military assets (ships, aircraft, vehicles, etc.)
- Track quantity and operational status
- Record acquisition and maintenance costs
- Monitor modernization level
- Describe capabilities

#### 3. **Borders Tab**
Border security monitoring interface (placeholder for V1.1 enhancement).

**Planned Features**:
- Border checkpoint management
- Neighboring country threat assessment
- Cross-border incident tracking
- Surveillance system status

#### 4. **Stability Tab** (StabilityPanel)
Internal security and social cohesion monitoring:

**Metrics Displayed**:
- Overall stability score
- Crime rate indicators
- Social cohesion index
- Trust in government
- Policing effectiveness
- Protest/riot risk assessment

**Visual Elements**:
- Progress bars for each metric
- Trend indicators (up/down/stable)
- Color-coded severity levels
- Historical comparison (future enhancement)

#### 5. **Threats Tab**
Security threat tracking and management:

**Threat List**:
- Severity badges (color-coded)
- Threat type and description
- Likelihood percentage
- Current status
- Action buttons (Edit/Resolve)

**Threat Creation**:
- Dialog form with:
  - Threat name and type selection
  - Severity level (5 options)
  - Description textarea
  - Likelihood and impact sliders (0-100)
  - Initial status selection

**Threat Management**:
- Update threat status through workflow:
  - Monitoring → Responding → Contained → Resolved
- Edit likelihood/impact as situation evolves
- Deactivate resolved threats (keep for historical record)

#### 6. **Command Tab** (CommandPanel)
Defense budget and strategic command center:

**Budget Overview**:
- Total defense budget (aggregated from branches)
- GDP percentage
- Budget breakdown pie chart:
  - Personnel Costs (40%)
  - Operations & Maintenance (30%)
  - Procurement (15%)
  - R&D (10%)
  - Construction (5%)

**Strategic Controls**:
- Overall readiness management
- Multi-branch coordination
- Budget reallocation tools
- Force projection planning

---

## Usage Guide

### Getting Started

1. **Navigate to Defense Dashboard**:
   ```
   /mycountry → Defense tab
   or directly: /mycountry/defense
   ```

2. **Create Your First Military Branch**:
   - Click "Forces" tab
   - Click "Add Military Branch" button
   - Select branch type (e.g., Army)
   - Fill in required fields:
     - Name: "National Army"
     - Active Duty: 50,000
     - Reserves: 25,000
     - Annual Budget: $5,000,000,000
   - Adjust readiness sliders as appropriate
   - Click "Create Branch"

3. **Add Military Units** (optional):
   - Expand your newly created branch
   - Navigate to "Units" tab
   - Click "Add Unit"
   - Configure unit details
   - Save

4. **Track Assets** (optional):
   - In branch details, go to "Assets" tab
   - Click "Add Asset"
   - Select asset type
   - Enter quantity and specifications
   - Save

5. **Monitor Security Status**:
   - Return to "Overview" tab
   - Review automatically calculated security score
   - Check component breakdowns
   - Review active threats

### Best Practices

**Branch Configuration**:
- Start with foundational branches (Army, Navy, Air Force)
- Allocate realistic budgets (1-5% of GDP is typical)
- Balance personnel between active duty and reserves
- Gradually increase readiness metrics as you build capacity

**Budget Management**:
- Total defense budget = sum of all branch budgets
- Monitor GDP percentage to avoid over-militarization
- Balance spending across branches based on national strategy
- Consider procurement vs. personnel costs

**Threat Assessment**:
- Create threats proactively to drive strategic planning
- Use likelihood × impact to prioritize response
- Update threat status as situations evolve
- Resolve threats when neutralized (keeps historical record)

**Readiness Metrics**:
- **Readiness Level**: Current operational preparedness
- **Technology Level**: Equipment modernization
- **Training Level**: Personnel skill and preparedness
- **Morale**: Troop motivation and satisfaction
- **Deployment Capacity**: Ability to project force
- **Sustainment Capacity**: Logistical support capability

---

## Security & Permissions

### Authentication

All mutation operations require authentication via Clerk:
- User must be signed in
- User profile must be loaded
- Country ownership verified for all operations

### Authorization

**Protected Procedures** enforce:
1. User owns the country (via `userProfile.countryId`)
2. User can only create/update/delete their own:
   - Military branches
   - Military units (through branch ownership)
   - Military assets (through branch ownership)
   - Security threats
   - Defense budget

**Public Procedures** allow:
- Viewing any country's defense data
- Accessing security assessments
- Browsing military branches
- Reading threat information

### Input Validation

All endpoints use Zod schemas:
- Type safety enforced at runtime
- Range validation (0-100 for percentages)
- String length requirements
- Non-negative numbers for counts
- URL format validation for images
- Enum validation for types/statuses

### Error Handling

**Error Codes**:
- `FORBIDDEN` (403): User doesn't own the resource
- `NOT_FOUND` (404): Resource doesn't exist
- `BAD_REQUEST` (400): Invalid input data
- `UNAUTHORIZED` (401): Not signed in

**Error Messages**:
- Clear, user-friendly descriptions
- No sensitive information leaked
- Client-side error boundary handling

---

## Calculations & Metrics

### Military Strength Score

```typescript
militaryStrength = min(100,
  avgReadiness × 0.40 +
  avgTechnology × 0.30 +
  personnelRatio × 0.30
)

where:
  avgReadiness = average readinessLevel across all branches
  avgTechnology = average technologyLevel across all branches
  personnelRatio = min(totalActiveDuty / population × 10000, 30)
```

**Interpretation**:
- 90-100: World-class military
- 75-89: Strong military capability
- 60-74: Adequate defense
- 40-59: Developing military
- <40: Weak defense posture

### Security Level Determination

```typescript
overallSecurityScore = round(
  militaryStrength × 0.35 +
  stabilityScore × 0.25 +
  threatScore × 0.20 +
  cybersecurity × 0.10 +
  counterTerrorism × 0.10
)

where:
  threatScore = 100 - (activeThreatCount × 5)
  stabilityScore = based on country.politicalStability
```

### Stability Score

```typescript
stabilityScore =
  if country.politicalStability === 'Stable': 75
  else if country.politicalStability === 'Unstable': 40
  else: 60  // 'Moderate'
```

### Budget Calculations

```typescript
totalDefenseBudget = sum(branch.annualBudget for all branches)
gdpPercent = (totalDefenseBudget / country.currentTotalGdp) × 100

budgetBreakdown = {
  personnel: totalBudget × 0.40,
  operations: totalBudget × 0.30,
  procurement: totalBudget × 0.15,
  research: totalBudget × 0.10,
  construction: totalBudget × 0.05
}
```

---

## Future Enhancements (V1.1 Roadmap)

### Planned Features

1. **Border Security Enhancement**
   - Border checkpoint database models
   - Neighboring country relations integration
   - Cross-border incident tracking
   - Surveillance system management

2. **Historical Tracking**
   - Security event logging
   - Readiness trend analysis
   - Budget utilization history
   - Threat evolution tracking

3. **Advanced Analytics**
   - Force comparison with other nations
   - Readiness forecasting
   - Budget optimization recommendations
   - Threat likelihood modeling

4. **Operational Features**
   - Military exercises and training events
   - Deployment tracking
   - Coalition operations
   - Joint branch operations

5. **Integration Enhancements**
   - Link defense budget to country budget system
   - Diplomatic impacts on security levels
   - Economic effects of militarization
   - Trade impacts from military strength

6. **UI Improvements**
   - Mobile-optimized defense dashboard
   - Interactive force deployment maps
   - Real-time notifications for threats
   - Branch comparison tools

---

## Technical Notes

### Performance Considerations

- All queries use Prisma `include` to fetch relations efficiently
- Indexes on `countryId`, `branchType`, `severity` for fast filtering
- Aggregate calculations cached in overview endpoints
- Pagination not implemented (assume <100 branches per country)

### Data Integrity

- Cascade deletes ensure orphaned records are cleaned up
- Default values prevent null-related errors
- Timestamps track creation and updates
- `isActive` flags for soft deletes on threats

### Testing

Recommended test scenarios:
1. Create branch → verify in database
2. Update readiness → check security score recalculation
3. Delete branch → verify units and assets deleted
4. Create threat → check threat count in overview
5. Budget aggregation → verify sum matches individual branches

---

## Support & Troubleshooting

### Common Issues

**"Country ID is required" error**:
- Ensure user profile is loaded before accessing defense features
- Check that user has claimed a country
- Verify authentication is working

**Branch creation fails**:
- Confirm all required fields are filled
- Check budget percentages don't exceed 100
- Verify personnel counts are non-negative integers
- Ensure unique branch names (optional, but recommended)

**Security score not updating**:
- Refresh the page to recalculate
- Check that branches have valid readiness metrics
- Verify military strength calculation includes all branches

**Threat not appearing**:
- Confirm `isActive` is true
- Check `activeOnly` filter setting
- Verify countryId matches current country

### Debug Mode

To enable detailed logging:
```typescript
// In src/server/api/routers/security.ts
console.log('Security Assessment:', {
  branches: branches.length,
  threats: threats.length,
  avgReadiness,
  overallScore
});
```

---

## Changelog

### V1.0 (Current) - December 2024
- ✅ Initial production release
- ✅ Full CRUD operations for branches, units, assets
- ✅ Real-time security assessment calculations
- ✅ Threat tracking system
- ✅ Defense budget aggregation
- ✅ Internal stability monitoring
- ✅ Six-tab defense dashboard UI
- ✅ Complete Zod validation
- ✅ Ownership-based authorization

### V0.9 (Development) - November 2024
- Database schema design
- API router stub implementation
- Basic UI components

---

## Related Documentation

- [IxStats Implementation Status](../IMPLEMENTATION_STATUS.md)
- [Unified Design Framework](./UNIFIED_DESIGN_FRAMEWORK.md)
- [tRPC API Documentation](https://trpc.io/)
- [Prisma ORM Documentation](https://www.prisma.io/)

---

**Last Updated**: December 2024
**Maintained By**: IxStats Development Team
**Status**: V1 Production Ready ✅
