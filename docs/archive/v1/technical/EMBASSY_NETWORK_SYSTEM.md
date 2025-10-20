# Embassy Network System

## Overview

The Embassy Network is a sophisticated diplomatic game system that allows countries to establish and manage embassies in other nations. It features live database integration, atomic government synergy detection, mission management, and progressive upgrade systems.

## Features

### 🏛️ **Embassy Management**
- **Establish Embassies**: Create diplomatic missions in other countries
- **Embassy Levels**: Progress from Level 1 to Level 5 through experience
- **Budget Management**: Allocate funds for operations and maintenance
- **Staff Management**: Assign diplomatic staff to missions and operations

### 🤝 **Atomic Government Synergies**
- **Synergy Detection**: Automatically detects shared atomic government components between countries
- **Bonus Calculation**: Calculates economic, diplomatic, and cultural bonuses based on government alignment
- **Network Power**: Aggregates all embassy synergies into a total network power score
- **Category Matching**: Groups synergies by Power Structure, Decision Making, Legitimacy, Institutions, and Control

### 🎯 **Mission System**
- **Mission Types**:
  - Trade Negotiation - Economic cooperation missions
  - Intelligence Gathering - Information collection operations
  - Cultural Outreach - Cultural diplomacy initiatives
  - Security Cooperation - Defense and security collaboration
  - Research Collaboration - Joint scientific projects

- **Mission Mechanics**:
  - Duration: 3-14 days based on complexity
  - Cost: Variable based on embassy level and mission type
  - Success Chance: Calculated from embassy stats and staff assigned
  - Rewards: Experience, influence, reputation, and economic gains

### ⬆️ **Embassy Upgrades**
Five upgrade paths with 3 levels each:

1. **Staff Expansion**
   - Level 1: +2 max staff, +1 mission capacity
   - Level 2: +4 max staff, +1 mission capacity
   - Level 3: +6 max staff, +2 mission capacity

2. **Security Enhancement**
   - Level 1: +5% mission success, security level 1
   - Level 2: +10% mission success, security level 2
   - Level 3: +15% mission success, security level 3

3. **Tech Upgrade**
   - Level 1: +10% efficiency, +15% intelligence gathering
   - Level 2: +20% efficiency, +30% intelligence gathering
   - Level 3: +30% efficiency, +45% intelligence gathering

4. **Facility Expansion**
   - Level 1: +20% capacity, +5 reputation
   - Level 2: +40% capacity, +10 reputation
   - Level 3: +60% capacity, +15 reputation

5. **Specialization Improvement**
   - Level 1: +25% specialized mission bonus
   - Level 2: +50% specialized mission bonus
   - Level 3: +75% specialized mission bonus

### 📊 **Influence & Relationships**
- **Influence Gain**: Earn influence through successful missions
- **Relationship Impact**: Influence affects diplomatic relationship strength
- **Automatic Progression**: Relationships evolve from tension → neutral → trade → alliance
- **Global Effects**: Total influence unlocks bonuses:
  - 100+: Trade bonus +5%/100 influence
  - 200+: Mission success bonus +3%/200 influence
  - 300+: Diplomatic immunity levels
  - 500+: Intelligence gathering bonus +10%/500 influence
  - 750+: Crisis response bonus +15%/750 influence

## Database Schema

### Embassy Table
```prisma
model Embassy {
  id                    String   @id @default(cuid())
  hostCountryId         String   // Country hosting the embassy
  guestCountryId        String   // Country that owns the embassy
  name                  String
  status                String   @default("active") // active, suspended, closed
  level                 Int      @default(1)
  experience            Int      @default(0)
  budget                Float    @default(100000)
  staffCount            Int      @default(5)
  maxStaff              Int      @default(10)
  currentMissions       Int      @default(0)
  maxMissions           Int      @default(2)
  influence             Float    @default(0)
  reputation            Float    @default(50)
  effectiveness         Float    @default(50)
  specialization        String?  // trade, intelligence, cultural, etc.
  specializationLevel   Int      @default(0)
  ambassadorName        String?
  location              String?
  maintenanceCost       Float    @default(5000)
  lastMaintenancePaid   DateTime @default(now())
  upgradeProgress       Float    @default(0)
  services              String?  // JSON array

  missions              EmbassyMission[]
  upgrades              EmbassyUpgrade[]

  establishedAt         DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Mission Table
```prisma
model EmbassyMission {
  id                    String   @id @default(cuid())
  embassyId             String
  embassy               Embassy  @relation(fields: [embassyId], references: [id], onDelete: Cascade)

  name                  String
  type                  String   // trade_negotiation, intelligence_gathering, etc.
  description           String
  difficulty            String   // easy, medium, hard, expert
  status                String   @default("active") // active, completed, failed, cancelled

  requiredStaff         Int      @default(1)
  cost                  Float
  duration              Int      // days
  progress              Float    @default(0)
  completesAt           DateTime

  experienceReward      Int
  influenceReward       Float
  reputationReward      Float
  economicReward        Float

  successChance         Float
  ixTimeStarted         String
  ixTimeCompletes       String

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Upgrade Table
```prisma
model EmbassyUpgrade {
  id                    String   @id @default(cuid())
  embassyId             String
  embassy               Embassy  @relation(fields: [embassyId], references: [id], onDelete: Cascade)

  upgradeType           String   // staff_expansion, security_enhancement, etc.
  name                  String
  description           String
  level                 Int
  cost                  Float
  duration              Int      // days
  status                String   @default("available")
  requiredLevel         Int
  effects               String   // JSON object

  startedAt             DateTime?
  completesAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

## API Integration

### tRPC Router: `diplomatic`

#### Embassy Operations
```typescript
// Get embassies for a country
api.diplomatic.getEmbassies.useQuery({ countryId });

// Establish new embassy
api.diplomatic.establishEmbassy.useMutation({
  hostCountryId, guestCountryId, name, location, ambassadorName
});

// Get embassy details with missions and upgrades
api.diplomatic.getEmbassyDetails.useQuery({ embassyId });

// Calculate establishment cost
api.diplomatic.calculateEstablishmentCost.useQuery({
  hostCountryId, guestCountryId, targetLocation
});
```

#### Mission Management
```typescript
// Get available missions
api.diplomatic.getAvailableMissions.useQuery({ embassyId });

// Start mission
api.diplomatic.startMission.useMutation({
  embassyId, missionType, staffAssigned, priorityLevel
});

// Complete mission (auto-called when mission completes)
api.diplomatic.completeMission.useMutation({ missionId });
```

#### Upgrade Management
```typescript
// Get available upgrades
api.diplomatic.getAvailableUpgrades.useQuery({ embassyId });

// Upgrade embassy
api.diplomatic.upgradeEmbassy.useMutation({
  embassyId, upgradeType, level
});
```

#### Financial Operations
```typescript
// Pay maintenance
api.diplomatic.payMaintenance.useMutation({ embassyId });

// Allocate additional budget
api.diplomatic.allocateBudget.useMutation({
  embassyId, additionalBudget
});
```

## Component Usage

### EnhancedEmbassyNetwork
```tsx
import { EnhancedEmbassyNetwork } from "~/components/diplomatic/EnhancedEmbassyNetwork";

<EnhancedEmbassyNetwork
  countryId={country.id}
  countryName={country.name}
  isOwner={isOwnCountry}
/>
```

**Features:**
- Displays all embassies with synergy scores
- Shows network power metrics
- Visualizes atomic government synergies
- Interactive embassy cards with expandable details
- Economic, diplomatic, and cultural bonus breakdown

## Atomic Synergy System

The embassy network automatically detects synergies between countries based on shared atomic government components:

### Component Categories
1. **Power Structure**: Centralized, Federal, Confederate, Unitary systems
2. **Decision Making**: Democratic, Autocratic, Technocratic, Consensus, Oligarchic
3. **Legitimacy**: Electoral, Traditional, Performance, Charismatic, Religious
4. **Institutions**: Professional Bureaucracy, Military, Judiciary, Partisan, Technocratic
5. **Control**: Rule of Law, Surveillance, Propaganda, Security Forces, Civil Society

### Synergy Calculation
```typescript
matchScore = (avgComponentEffectiveness + embassyStrength) / 2
economicBonus = matchScore * 0.04
diplomaticBonus = matchScore * 0.06
culturalBonus = matchScore * 0.03
```

### Benefits
- **Economic Bonus**: Trade efficiency, investment returns
- **Diplomatic Bonus**: Negotiation success, relationship improvement
- **Cultural Bonus**: Cultural exchange success, soft power

## Game Mechanics

### Embassy Level Progression
- **Level 1**: Basic embassy, 2 mission capacity
- **Level 2**: Experienced embassy, 3 mission capacity (1000 XP required)
- **Level 3**: Advanced embassy, 4 mission capacity (2500 XP required)
- **Level 4**: Elite embassy, 5 mission capacity (5000 XP required)
- **Level 5**: Master embassy, 6 mission capacity (10000 XP required)

### Mission Success Calculation
```typescript
baseChance = 60
+ difficultyModifier // easy: +20, medium: 0, hard: -15, expert: -25
+ (embassyLevel - 1) * 8
+ (staffAssigned - 1) * 5
+ (embassyEffectiveness - 50) * 0.3
+ specializationBonus // if applicable

finalChance = clamp(baseChance, 10, 95) // 10-95% range
```

### Maintenance System
- **Cost**: Base 5000 per month
- **Due**: Every 30 days
- **Late Penalty**: -2 effectiveness per day overdue
- **On-Time Bonus**: +2 effectiveness

## UI/UX Features

### Network Overview Card
- Total active embassies count
- Network power score (embassies * 10 + avgSynergy * 2)
- Average synergy score across all embassies
- Total economic/diplomatic/cultural bonuses

### Embassy Cards
- Embassy country name and flag
- Status badge (active/strengthening/neutral)
- Strength meter (0-100)
- Synergy score with visual indicator
- Bonus breakdown (economic/diplomatic/cultural)
- Expandable synergy details showing:
  - Shared component categories
  - Match percentage
  - Specific components matched

### Empty State
- Helpful message for countries with no embassies
- Call-to-action button to establish first embassy
- Explanation of synergy benefits

## Integration Points

### With Atomic Government System
- Automatically queries country's atomic components
- Calculates synergies on component updates
- Real-time synergy recalculation when governments change

### With Activity Feed
- Embassy establishment generates feed entry
- Mission completion creates activity events
- Influence milestones trigger notifications

### With Diplomatic Events
- Mission outcomes create diplomatic events
- Relationship changes logged as events
- Major influence shifts recorded

## Future Enhancements

### Planned Features
- [ ] Embassy specialization trees
- [ ] Multi-country embassy networks
- [ ] Trade route bonuses through embassies
- [ ] Intelligence gathering mini-game
- [ ] Crisis management missions
- [ ] Diplomatic incident system
- [ ] Embassy staff management UI
- [ ] Visual embassy network map
- [ ] Historical mission archive
- [ ] Achievement system for diplomacy

### Potential Improvements
- Real-time mission progress updates
- WebSocket integration for live notifications
- Mobile-optimized embassy management
- Batch mission operations
- Advanced analytics dashboard
- AI-powered mission recommendations

## Best Practices

### For Players
1. **Diversify Embassy Network**: Establish embassies across different economic tiers
2. **Match Government Types**: Target countries with compatible atomic components
3. **Maintain Regularly**: Pay maintenance on time to maintain effectiveness
4. **Upgrade Strategically**: Focus on upgrades that match your diplomatic goals
5. **Balance Budget**: Don't overextend with too many expensive missions

### For Developers
1. **Database Queries**: Use includes to fetch related data efficiently
2. **Error Handling**: Always validate embassy ownership before operations
3. **Transaction Safety**: Use Prisma transactions for multi-step operations
4. **Cache Strategy**: Cache synergy calculations when atomic components don't change
5. **Performance**: Index foreign keys for faster embassy/mission lookups

## Troubleshooting

### Common Issues

**Embassy not appearing:**
- Check that establishment mutation completed successfully
- Verify country IDs are correct
- Ensure user has permission to establish embassies

**Synergies not calculating:**
- Confirm atomic government components exist for country
- Check that component effectiveness scores are set
- Verify synergy threshold (must be > 30% to display)

**Missions not starting:**
- Check embassy has available mission capacity
- Verify sufficient budget for mission cost
- Ensure enough staff available

**Upgrades not available:**
- Confirm embassy level meets requirement
- Check budget is sufficient
- Verify upgrade not already in progress

## Related Documentation
- [Atomic Government System](./ATOMIC_GOVERNMENT_SYSTEM.md)
- [Diplomatic Router API](../src/server/api/routers/diplomatic.ts)
- [Activity Feed Integration](./ACTIVITY_FEED_SYSTEM.md)
- [Secure Diplomatic Channels](./SECURE_DIPLOMATIC_CHANNELS.md)
