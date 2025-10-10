# Security & Defense System Implementation Plan

## Current Status
The security/defense system is currently **stubbed** with mock data to satisfy TypeScript compilation. All API endpoints return placeholder values and no database persistence exists.

## Files Affected
- **Stub Implementation (Active)**:
  - `src/server/api/routers/security.ts` - Stub router with mock data
  - `src/lib/defense-integration.ts` - Stub integration functions

- **Full Implementation (Backed Up)**:
  - `src/server/api/routers/security.ts.full` - Complete router (1,102 lines)
  - `src/lib/defense-integration.ts.full` - Complete integration library

## Required Prisma Models

Add these models to `prisma/schema.prisma`:

```prisma
// Security & Defense Models

model SecurityAssessment {
  id                   String   @id @default(cuid())
  countryId            String   @unique
  country              Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  overallThreatLevel   Int      @default(3) // 1-5 scale
  internalStability    Float    @default(75)
  borderSecurity       Float    @default(80)
  militaryReadiness    Float    @default(70)
  activeThreats        Int      @default(0)

  lastAssessment       DateTime @default(now())
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([countryId])
}

model MilitaryBranch {
  id                String   @id @default(cuid())
  countryId         String
  country           Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  branchType        String   // army, navy, air_force, space_force, marines, etc.
  name              String
  description       String?
  motto             String?
  established       String?

  activeDuty        Int      @default(0)
  reserves          Int      @default(0)
  readinessLevel    Float    @default(70)
  technologyLevel   Float    @default(50)
  morale            Float    @default(75)

  annualBudget      Float    @default(0)
  headquarters      String?
  commander         String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  units             MilitaryUnit[]
  assets            MilitaryAsset[]

  @@index([countryId])
  @@index([branchType])
}

model MilitaryUnit {
  id                String         @id @default(cuid())
  branchId          String
  branch            MilitaryBranch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  name              String
  type              String         // infantry, armor, naval, air, special_ops, etc.
  designation       String?
  personnel         Int            @default(0)
  readiness         Float          @default(70)

  location          String?
  status            String         @default("active") // active, reserve, training, deployed

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([branchId])
  @@index([status])
}

model MilitaryAsset {
  id                String         @id @default(cuid())
  branchId          String
  branch            MilitaryBranch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  name              String
  type              String         // aircraft, naval_vessel, ground_vehicle, weapons_system, etc.
  category          String         // strategic, tactical, support
  quantity          Int            @default(1)
  operational       Int            @default(1)

  specifications    String?        @db.Text
  acquisitionCost   Float?
  maintenanceCost   Float?

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([branchId])
  @@index([type])
}

model DefenseBudget {
  id                String   @id @default(cuid())
  countryId         String   @unique
  country           Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  totalBudget       Float    @default(0)
  gdpPercent        Float    @default(2.5)

  personnel         Float    @default(0)
  operations        Float    @default(0)
  procurement       Float    @default(0)
  research          Float    @default(0)
  infrastructure    Float    @default(0)

  fiscalYear        Int

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([countryId])
  @@index([fiscalYear])
}

model InternalStabilityMetrics {
  id                    String   @id @default(cuid())
  countryId             String   @unique
  country               Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  stabilityIndex        Float    @default(75)
  governmentApproval    Float    @default(60)
  civilUnrest           Float    @default(15)
  crimeRate             Float    @default(20)

  politicalPolarization Float    @default(30)
  ethnicTensions        Float    @default(10)
  economicStress        Float    @default(25)

  lastCalculated        DateTime @default(now())
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([countryId])
}

model SecurityEvent {
  id                String   @id @default(cuid())
  countryId         String
  country           Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  type              String   // protest, terrorism, coup, border_incident, etc.
  severity          String   // low, medium, high, critical
  status            String   @default("active") // active, resolved, escalating

  title             String
  description       String   @db.Text
  location          String?

  stabilityImpact   Float    @default(0)
  casualties        Int      @default(0)

  startDate         DateTime @default(now())
  resolvedDate      DateTime?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([countryId])
  @@index([status])
  @@index([severity])
}

model BorderSecurity {
  id                String   @id @default(cuid())
  countryId         String   @unique
  country           Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  borderIntegrity   Float    @default(85)
  patrolCoverage    Float    @default(70)
  technology        Float    @default(50)

  totalBorders      Int      @default(0)
  securedBorders    Int      @default(0)

  incidentsMonth    Int      @default(0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  assessments       NeighborThreatAssessment[]

  @@index([countryId])
}

model NeighborThreatAssessment {
  id                String         @id @default(cuid())
  borderSecurityId  String
  borderSecurity    BorderSecurity @relation(fields: [borderSecurityId], references: [id], onDelete: Cascade)

  neighborCountry   String
  threatLevel       Int            @default(2) // 1-5 scale
  relationship      String         // friendly, neutral, tense, hostile

  militaryPresence  Float          @default(50)
  disputes          String?        @db.Text

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([borderSecurityId])
}

model SecurityThreat {
  id                String   @id @default(cuid())
  countryId         String
  country           Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  type              String   // terrorism, espionage, cyber, WMD, conventional_military, etc.
  severity          String   // low, medium, high, critical, existential
  status            String   @default("active") // active, monitoring, neutralized

  name              String
  description       String   @db.Text
  origin            String?  // domestic, foreign, transnational

  probability       Float    @default(25)
  impact            Float    @default(50)

  incidents         ThreatIncident[]

  firstIdentified   DateTime @default(now())
  lastUpdate        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([countryId])
  @@index([severity])
  @@index([status])
}

model ThreatIncident {
  id                String         @id @default(cuid())
  threatId          String
  threat            SecurityThreat @relation(fields: [threatId], references: [id], onDelete: Cascade)

  title             String
  description       String         @db.Text
  location          String?
  casualties        Int            @default(0)
  damages           Float          @default(0)

  incidentDate      DateTime
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([threatId])
  @@index([incidentDate])
}
```

## Country Model Updates

Add these relations to the existing `Country` model:

```prisma
model Country {
  // ... existing fields ...

  // Security Relations
  securityAssessment           SecurityAssessment?
  militaryBranches             MilitaryBranch[]
  defenseBudget                DefenseBudget?
  internalStability            InternalStabilityMetrics?
  securityEvents               SecurityEvent[]
  borderSecurity               BorderSecurity?
  securityThreats              SecurityThreat[]

  // ... rest of existing relations ...
}
```

## Implementation Steps

### Phase 1: Database Schema
1. ✅ Add Prisma models to schema.prisma
2. ✅ Run migration: `npx prisma migrate dev --name add-security-system`
3. ✅ Generate Prisma client: `npx prisma generate`

### Phase 2: Restore Full Implementation
1. ✅ Replace `src/server/api/routers/security.ts` with `security.ts.full`
2. ✅ Replace `src/lib/defense-integration.ts` with `defense-integration.ts.full`
3. ✅ Test compilation: `npm run typecheck`

### Phase 3: Testing & Validation
1. ✅ Test all security API endpoints
2. ✅ Verify defense integration functions
3. ✅ Check UI components render correctly
4. ✅ Test data persistence

### Phase 4: Cleanup
1. ✅ Remove `.full` backup files
2. ✅ Update documentation
3. ✅ Commit changes

## UI Components Using Security System

These components currently use the stubbed security API:
- `src/app/mycountry/defense/page.tsx`
- `src/components/defense/AssetManager.tsx`
- `src/components/defense/CommandPanel.tsx`
- `src/components/defense/MilitaryCustomizer.tsx`
- `src/components/defense/StabilityPanel.tsx`
- `src/components/defense/UnitManager.tsx`
- `src/components/mycountry/EnhancedMyCountryContent.tsx`
- `src/components/quickactions/DefenseModal.tsx`

## Optional Dependencies

These are **not required** but provide enhanced functionality:

```bash
# HTTP Proxy (for wiki API proxying)
npm install http-proxy
npm install -D @types/http-proxy

# Puppeteer (for Cloudflare bypass - not recommended)
npm install puppeteer
```

**Note**: The wiki proxy functionality works fine without these dependencies using Next.js rewrites.

## Estimation

- **Database Schema**: 30 minutes
- **Implementation Restore**: 15 minutes
- **Testing**: 1-2 hours
- **Total**: ~2-3 hours

## Notes

- The stub implementation provides a working interface for all defense/security features
- No data is persisted to the database in stub mode
- All mock values are reasonable defaults for testing
- The full implementation includes sophisticated calculations and integrations with:
  - Intelligence system
  - Government budget system
  - Economic indicators
  - Diplomatic relations

## Related Documentation

- Full security router: `src/server/api/routers/security.ts.full`
- Full defense integration: `src/lib/defense-integration.ts.full`
- Atomic government system: `docs/technical/ATOMIC_SYSTEM_ARCHITECTURE.md`
- Economic systems: `docs/technical/ECONOMIC_SYSTEMS_README.md`
