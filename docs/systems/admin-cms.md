# Admin Content Management System

**Last updated:** November 2025

Comprehensive guide to IxStats' 17 admin interfaces for managing dynamic content, reference data, and system configuration.

## Table of Contents
1. [Overview](#overview)
2. [Reference Data Management (9 interfaces)](#reference-data-management)
3. [Intelligence & Templates (2 interfaces)](#intelligence--templates)
4. [Analytics & Monitoring (4 interfaces)](#analytics--monitoring)
5. [System Administration (2 interfaces)](#system-administration)
6. [Access Control](#access-control)
7. [Bulk Operations](#bulk-operations)

---

## Overview

### Purpose

The Admin CMS enables **100% dynamic content management** - all game content lives in the database and can be updated without code deployments. This includes:

- 24 atomic government components
- 40+ economic policy components
- 42 tax system components
- 50+ diplomatic actions
- 100+ diplomatic scenarios
- 8 NPC personality traits
- 500+ military equipment items
- Intelligence briefing templates

### Architecture

```
┌──────────────────────────────────────────────┐
│           Admin Dashboard (/admin)           │
│  Role-based access, audit logging, search   │
└───────────────┬──────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ↓                ↓
┌─────────────────┐  ┌──────────────────┐
│  Reference Data │  │  Analytics &     │
│  9 Interfaces   │  │  Monitoring      │
│                 │  │  4 Interfaces    │
└─────────────────┘  └──────────────────┘
        │                │
        ↓                ↓
┌─────────────────┐  ┌──────────────────┐
│  Intelligence & │  │  System Admin    │
│  Templates      │  │  2 Interfaces    │
│  2 Interfaces   │  │                  │
└─────────────────┘  └──────────────────┘
        │
        ↓
┌─────────────────────────────────────────┐
│         Database (PostgreSQL)            │
│  - Atomic components                    │
│  - Scenarios & templates                │
│  - Equipment catalogs                   │
│  - Change audit logs                    │
└─────────────────────────────────────────┘
```

---

## Reference Data Management

### 1. Government Components (`/admin/government-components`)

**Purpose:** Manage 24 atomic government building blocks

**Features:**
- CRUD operations for government components
- Effectiveness score configuration (0-100)
- Synergy relationship management
- Category assignment (Power Structure, Decision Making, etc.)
- Description and effects documentation

**Data Model:**
```typescript
interface GovernmentComponent {
  id: string;
  componentType: ComponentType; // enum: DEMOCRATIC_PROCESS, FEDERAL_SYSTEM, etc.
  name: string;
  description: string;
  category: string; // "Power Structure", "Decision Making", etc.
  effectivenessScore: number; // 0-100
  synergies: string[]; // IDs of compatible components
  conflicts: string[]; // IDs of incompatible components
  prerequisites: string[];
  effects: {
    economic: number;
    stability: number;
    efficiency: number;
  };
  tier: string; // "ALL", "ADVANCED", etc.
}
```

**Example Entry:**
```json
{
  "componentType": "DEMOCRATIC_PROCESS",
  "name": "Democratic Process",
  "description": "Free and fair elections with universal suffrage",
  "category": "Decision Making",
  "effectivenessScore": 85,
  "synergies": ["RULE_OF_LAW", "INDEPENDENT_JUDICIARY", "FREE_PRESS"],
  "conflicts": ["AUTOCRATIC_PROCESS", "SINGLE_PARTY_STATE"],
  "effects": {
    "economic": 0.5,
    "stability": 0.8,
    "efficiency": 0.6
  }
}
```

**UI Features:**
- Search and filter by category
- Effectiveness score slider
- Synergy matrix visualization
- Bulk effectiveness adjustment
- Export to CSV/JSON

**API Endpoints:**
```typescript
api.governmentComponents.getAll.useQuery()
api.governmentComponents.create.useMutation()
api.governmentComponents.update.useMutation()
api.governmentComponents.delete.useMutation()
api.governmentComponents.bulkUpdate.useMutation()
```

### 2. Economic Components (`/admin/economic-components`)

**Purpose:** Manage 40+ economic policy components

**Data Model:**
```typescript
interface EconomicComponent {
  id: string;
  componentType: EconomicComponentType;
  name: string;
  description: string;
  category: string; // "Market System", "Social Policy", etc.
  impactModifiers: {
    gdpGrowth: number; // -5.0 to +5.0
    employment: number;
    innovation: number;
    inequality: number;
  };
  prerequisites: string[];
  incompatibleWith: string[];
  recommendedFor: string[]; // Economic tiers
}
```

**Categories:**
- Market Systems (Free Market, Planned Economy, Mixed)
- Social Policies (Welfare State, Universal Healthcare)
- Innovation (R&D Support, Knowledge Economy)
- Trade (Free Trade, Protectionism)
- Labor (Strong Unions, Flexible Labor)

**Example:**
```json
{
  "componentType": "INNOVATION_ECOSYSTEM",
  "name": "Innovation Ecosystem",
  "description": "Comprehensive support for research, development, and entrepreneurship",
  "category": "Innovation & Technology",
  "impactModifiers": {
    "gdpGrowth": 1.2,
    "employment": 0.3,
    "innovation": 2.5,
    "inequality": -0.2
  },
  "prerequisites": ["KNOWLEDGE_ECONOMY", "ENTREPRENEURSHIP_SUPPORT"],
  "incompatibleWith": ["PLANNED_ECONOMY"],
  "recommendedFor": ["Tier 4", "Tier 5"]
}
```

### 3. Tax Components (`/admin/tax-components`)

**Purpose:** Manage 42 tax system components

**Data Model:**
```typescript
interface TaxComponent {
  id: string;
  componentType: TaxComponentType;
  name: string;
  category: string; // "Income Tax", "Corporate Tax", "Consumption Tax"
  rateRange: {
    min: number;
    max: number;
    recommended: number;
  };
  revenueFormula: string; // Calculation formula
  complianceRate: number; // 0-100
  administrativeCost: number; // % of revenue
  economicEffect: {
    gdpImpact: number;
    inequalityEffect: number;
    businessImpact: number;
  };
}
```

**Categories:**
- Income Tax (Progressive, Flat, Negative Income Tax)
- Corporate Tax (Standard, Territorial, Worldwide)
- Consumption Tax (VAT, Sales Tax, Excise)
- Property Tax (Land Value, Real Estate)
- Wealth Tax (Net Worth, Estate, Inheritance)
- Specialized (Carbon Tax, Financial Transaction)

**Example:**
```json
{
  "componentType": "PROGRESSIVE_INCOME_TAX",
  "name": "Progressive Income Tax",
  "category": "Income Tax",
  "rateRange": { "min": 10, "max": 50, "recommended": 30 },
  "revenueFormula": "SUM(bracketRevenue[i]) for all brackets",
  "complianceRate": 85,
  "administrativeCost": 2.5,
  "economicEffect": {
    "gdpImpact": -0.3,
    "inequalityEffect": -1.5,
    "businessImpact": -0.2
  }
}
```

### 4. Economic Archetypes (`/admin/economic-archetypes`)

**Purpose:** Manage 12+ economy templates with preset component combinations

**Data Model:**
```typescript
interface EconomicArchetype {
  id: string;
  name: string;
  description: string;
  components: string[]; // Economic component IDs
  tierMapping: {
    tier1: number; // % countries of this tier matching archetype
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
  };
  characteristics: {
    marketFreedom: number; // 0-100
    socialWelfare: number;
    stateIntervention: number;
    innovation: number;
  };
}
```

**Examples:**
- Free Market Capitalism
- Social Market Economy
- Planned Economy
- Developmental State
- Nordic Model
- Asian Tiger Model

### 5. Diplomatic Options (`/admin/diplomatic-options`)

**Purpose:** Manage 50+ diplomatic actions available to players

**Data Model:**
```typescript
interface DiplomaticOption {
  id: string;
  actionType: DiplomaticActionType;
  name: string;
  description: string;
  category: string; // "Trade", "Security", "Cultural", "Political"
  cost: {
    financial: number;
    diplomaticCapital: number;
    timeInDays: number;
  };
  cooldown: number; // Days before can be used again
  prerequisites: {
    relationshipMinimum: number;
    embassyRequired: boolean;
    sharedComponents: number;
  };
  successProbabilityFormula: string;
  effects: {
    relationshipChange: { min: number; max: number };
    economicBenefit: number;
    prestigeChange: number;
  };
}
```

**Example:**
```json
{
  "actionType": "TRADE_AGREEMENT",
  "name": "Bilateral Trade Agreement",
  "description": "Negotiate a comprehensive free trade agreement",
  "category": "Trade",
  "cost": {
    "financial": 5000000,
    "diplomaticCapital": 15,
    "timeInDays": 180
  },
  "cooldown": 365,
  "prerequisites": {
    "relationshipMinimum": 50,
    "embassyRequired": true,
    "sharedComponents": 2
  },
  "successProbabilityFormula": "(relationshipStrength * 0.6) + (economicCompatibility * 0.4)",
  "effects": {
    "relationshipChange": { "min": 5, "max": 15 },
    "economicBenefit": 2.5,
    "prestigeChange": 3
  }
}
```

### 6. Diplomatic Scenarios (`/admin/diplomatic-scenarios`)

**Purpose:** Manage 100+ dynamic diplomatic scenario templates

**Data Model:**
```typescript
interface DiplomaticScenario {
  id: string;
  title: string;
  description: string;
  triggerConditions: {
    relationshipRange: { min: number; max: number };
    requiredTraits: string[]; // NPC personality traits
    regionalContext: string[];
    randomProbability: number;
  };
  choices: DiplomaticChoice[];
  outcomes: {
    choiceId: string;
    effects: {
      relationship: number;
      economic: number;
      reputation: number;
    };
    followUpScenario?: string;
  }[];
  personalityModifiers: {
    archetype: string;
    probabilityMultiplier: number;
  }[];
}

interface DiplomaticChoice {
  id: string;
  text: string;
  tone: "AGGRESSIVE" | "NEUTRAL" | "CONCILIATORY";
  requiresResource: boolean;
  cost?: number;
}
```

**Example:**
```json
{
  "title": "Border Dispute Escalation",
  "description": "Tensions rise over contested border region",
  "triggerConditions": {
    "relationshipRange": { "min": 20, "max": 50 },
    "requiredTraits": ["HIGH_ASSERTIVENESS"],
    "regionalContext": ["SHARED_BORDER"],
    "randomProbability": 0.15
  },
  "choices": [
    {
      "id": "military_posture",
      "text": "Deploy military forces to contested region",
      "tone": "AGGRESSIVE",
      "requiresResource": true,
      "cost": 10000000
    },
    {
      "id": "negotiate",
      "text": "Propose neutral arbitration",
      "tone": "CONCILIATORY",
      "requiresResource": false
    }
  ]
}
```

### 7. NPC Personalities (`/admin/npc-personalities`)

**Purpose:** Configure 8 personality traits and archetype definitions

**Data Model:**
```typescript
interface NPCPersonalityConfig {
  countryId: string;
  traits: {
    assertiveness: { value: number; locked: boolean };
    cooperativeness: { value: number; locked: boolean };
    economicFocus: { value: number; locked: boolean };
    culturalOpenness: { value: number; locked: boolean };
    riskTolerance: { value: number; locked: boolean };
    ideologicalRigidity: { value: number; locked: boolean };
    militarism: { value: number; locked: boolean };
    isolationism: { value: number; locked: boolean };
  };
  archetype: PersonalityArchetype | "AUTO";
  manualOverride: boolean;
}
```

**Features:**
- View calculated traits from database metrics
- Manually override specific traits
- Lock traits to prevent drift
- Force specific archetype
- Test response predictions
- View trait evolution history

### 8. Military Equipment (`/admin/military-equipment`)

**Purpose:** Manage 500+ military equipment catalog

**Data Model:**
```typescript
interface MilitaryEquipment {
  id: string;
  name: string;
  type: EquipmentType; // AIRCRAFT, SHIP, TANK, etc.
  subtype: string;
  manufacturer: string;
  countryOfOrigin: string;
  specifications: {
    crew: number;
    weight: number;
    speed: number;
    range: number;
    armament: string[];
  };
  cost: {
    unitPrice: number;
    maintenanceCostAnnual: number;
  };
  availability: {
    inProduction: boolean;
    exportRestricted: boolean;
    minimumOrder: number;
  };
  images: {
    thumbnail: string;
    gallery: string[];
  };
}
```

**Categories:**
- Aircraft (Fighters, Bombers, Transport)
- Naval (Carriers, Destroyers, Submarines)
- Ground Vehicles (Tanks, APCs, Artillery)
- Missiles & Rockets
- Electronic Warfare
- Small Arms (see separate interface)

### 9. Small Arms Equipment (`/admin/military-equipment/small-arms`)

**Purpose:** Manage infantry weapons catalog

**Data Model:**
```typescript
interface SmallArmsEquipment {
  id: string;
  name: string;
  type: "RIFLE" | "PISTOL" | "MACHINE_GUN" | "SNIPER" | "GRENADE_LAUNCHER";
  caliber: string;
  manufacturer: string;
  specifications: {
    weight: number; // kg
    length: number; // mm
    barrelLength: number;
    effectiveRange: number; // meters
    rateOfFire: number; // rounds/min
    magazineCapacity: number;
  };
  cost: {
    unitPrice: number;
    maintenanceCost: number;
  };
}
```

---

## Intelligence & Templates

### 10. Intelligence Templates (`/admin/intelligence-templates`)

**Purpose:** Manage pre-written briefing templates

**Data Model:**
```typescript
interface IntelligenceTemplate {
  id: string;
  title: string;
  classification: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  category: "ECONOMIC" | "DIPLOMATIC" | "SECURITY" | "DOMESTIC";
  template: string; // Markdown with placeholders
  placeholders: {
    name: string;
    type: "STRING" | "NUMBER" | "DATE" | "COUNTRY";
    source: string; // Database query or calculation
  }[];
  priority: number; // 1-10
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "ON_EVENT";
}
```

**Example:**
```json
{
  "title": "Economic Vulnerability Assessment",
  "classification": "CONFIDENTIAL",
  "category": "ECONOMIC",
  "template": "# Economic Vulnerability Assessment\n\n{{country_name}} faces {{risk_level}} economic risks:\n\n- Debt-to-GDP: {{debt_ratio}}%\n- Budget deficit: {{deficit}}%\n\n**Recommendation:** {{recommendation}}",
  "placeholders": [
    { "name": "country_name", "type": "STRING", "source": "country.name" },
    { "name": "debt_ratio", "type": "NUMBER", "source": "country.totalDebtGDPRatio" }
  ],
  "priority": 8,
  "frequency": "WEEKLY"
}
```

### 11. Crisis Event Templates

**Purpose:** Define crisis event types and progression

(Covered in detail in [crisis-events.md](./crisis-events.md))

---

## Analytics & Monitoring

### 12. Diplomatic Options Analytics (`/admin/diplomatic-options/analytics`)

**Purpose:** Track usage and effectiveness of diplomatic actions

**Metrics:**
- Usage frequency by action type
- Success rates
- Average relationship change
- Economic impact assessment
- Most/least popular actions
- Cost-benefit analysis

**Visualizations:**
- Action usage heatmap
- Success rate trends
- Relationship improvement by action type
- ROI comparison

### 13. Diplomatic Scenarios Analytics (`/admin/diplomatic-scenarios/analytics`)

**Purpose:** Monitor scenario triggers and outcomes

**Metrics:**
- Scenario trigger frequency
- Choice distribution
- Outcome effectiveness
- Player vs NPC choice patterns
- Archetype-specific behavior

### 14. Military Equipment Analytics (`/admin/military-equipment/analytics`)

**Purpose:** Track equipment procurement and usage

**Metrics:**
- Most purchased equipment
- Country procurement patterns
- Manufacturer market share
- Price trends
- Availability analysis

### 15. Maps Monitoring (`/admin/maps-monitoring`)

**Purpose:** Monitor map system performance

(Covered in detail in [map-system.md](./map-system.md))

**Metrics:**
- Tile requests per minute
- Cache hit rates by layer
- Martin server status
- Redis memory usage
- Error rates
- Average response times

---

## System Administration

### 16. Membership Management (`/admin/membership`)

**Purpose:** Manage user roles, permissions, and country assignments

**Features:**
- User list with search/filter
- Role assignment (SUPER_ADMIN, ADMIN, MODERATOR, USER)
- Country assignment/reassignment
- Access control matrix
- Audit log of admin actions

**Data Model:**
```typescript
interface UserRole {
  userId: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "USER";
  permissions: Permission[];
  assignedCountry?: string;
  assignedBy: string;
  assignedAt: Date;
}

enum Permission {
  MANAGE_USERS,
  EDIT_REFERENCE_DATA,
  VIEW_ANALYTICS,
  TRIGGER_EVENTS,
  MANAGE_COUNTRIES,
  VIEW_AUDIT_LOGS
}
```

**Role Hierarchy:**
```
SUPER_ADMIN
  ├─ Full system access
  ├─ Can assign all roles
  └─ Can delete data

ADMIN
  ├─ Content management
  ├─ User oversight
  └─ Cannot delete core data

MODERATOR
  ├─ Content review
  ├─ Limited editing
  └─ No user management

USER
  └─ No admin access
```

### 17. Map Editor (`/admin/map-editor`)

**Purpose:** GIS editing interface for map data

(Covered in detail in [map-system.md](./map-system.md))

---

## Access Control

### Permission System

**Check before action:**
```typescript
async function checkPermission(
  userId: string,
  action: AdminAction
): Promise<boolean> {
  const userRole = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  const requiredPermission = ACTION_PERMISSION_MAP[action];

  return ROLE_PERMISSIONS[userRole.role].includes(requiredPermission);
}
```

**Audit Logging:**
```typescript
// All admin actions logged
await db.auditLog.create({
  data: {
    userId,
    action: 'UPDATE_COMPONENT',
    resourceType: 'GOVERNMENT_COMPONENT',
    resourceId: componentId,
    changes: {
      before: oldData,
      after: newData
    },
    ipAddress,
    timestamp: new Date()
  }
});
```

---

## Bulk Operations

All admin interfaces support bulk operations for efficiency.

### Bulk Import

**CSV Format:**
```csv
componentType,name,description,effectivenessScore,category
DEMOCRATIC_PROCESS,"Democratic Process","Free and fair elections",85,"Decision Making"
FEDERAL_SYSTEM,"Federal System","Power divided between levels",78,"Power Structure"
```

**Import Process:**
```typescript
api.governmentComponents.bulkImport.useMutation({
  onSuccess: (data) => {
    console.log(`Imported ${data.created} components`);
    console.log(`Updated ${data.updated} components`);
    console.log(`Errors: ${data.errors.length}`);
  }
});
```

### Bulk Export

**Export to CSV/JSON:**
```typescript
api.governmentComponents.export.useQuery({
  format: 'CSV',
  includeRelations: true
});
```

### Bulk Update

**Update multiple records:**
```typescript
api.governmentComponents.bulkUpdate.useMutation({
  input: {
    ids: ['comp1', 'comp2', 'comp3'],
    updates: {
      effectivenessScore: 90
    }
  }
});
```

---

## Related Documentation

- [NPC AI System](./npc-ai.md) - Personality configuration
- [Map System](./map-system.md) - GIS editing and monitoring
- [Crisis Events](./crisis-events.md) - Event templates
- [API Reference](../reference/api-complete.md) - Admin API endpoints
