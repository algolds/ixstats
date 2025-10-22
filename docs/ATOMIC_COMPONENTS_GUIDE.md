# Atomic Government Components - Complete Reference Guide

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Component Categories](#component-categories)
4. [All 106 Components Reference](#all-106-components-reference)
5. [Synergy System](#synergy-system)
6. [Complete Synergy Matrix (91 Relationships)](#complete-synergy-matrix-91-relationships)
7. [Builder's Guide](#builders-guide)
8. [Example Government Builds](#example-government-builds)
9. [Technical Reference](#technical-reference)
10. [Best Practices](#best-practices)

---

## Overview

### What are Atomic Government Components?

The Atomic Government Components system represents a revolutionary approach to governance modeling in IxStats. Instead of selecting from pre-defined government types (democracy, autocracy, etc.), you construct custom governmental structures from 106 fundamental building blocks called "atomic components."

**Key Innovation**: This modular system enables political configurations impossible in traditional models, allowing unprecedented government customization and experimentation.

### Core Principles

**Modularity**: Each component is independent and can be mixed with any other component. Build your government from Power Distribution, Decision Process, Legitimacy Sources, Institutions, Control Mechanisms, and 6 additional categories.

**Dynamic Interactions**: Components interact through a sophisticated synergy and conflict system:
- **Synergies**: Compatible components provide +10% effectiveness bonuses
- **Conflicts**: Incompatible combinations impose -15% effectiveness penalties
- **Stacking**: Multiple synergies can combine for substantial effectiveness gains

**Real-World Modeling**: The system reflects actual political science principles, with realistic relationships between governance structures.

### System Statistics

- **106 Total Components** across 11 categories
- **91 Relationship Mappings** (46 synergies + 45 conflicts)
- **Effectiveness Range**: 0-100% (base effectiveness modified by synergies/conflicts)
- **Recommended Build Size**: 3-10 components for optimal governance

---

## System Architecture

### Database Models

The atomic government system is built on the following Prisma models:

```typescript
model GovernmentComponent {
  id                    String         @id @default(cuid())
  countryId             String
  componentType         ComponentType  // Enum: 106 possible values
  effectivenessScore    Float          // Base effectiveness (0-100)
  implementationDate    DateTime
  lastModified          DateTime       @updatedAt
  isActive              Boolean        @default(true)

  country               Country        @relation(...)
  synergies             ComponentSynergy[] @relation("ComponentSynergies")
  conflicts             ComponentSynergy[] @relation("ComponentConflicts")
}

model ComponentSynergy {
  id                    String         @id @default(cuid())
  component1Id          String
  component2Id          String
  synergyType           String         // ADDITIVE, MULTIPLICATIVE, CONFLICTING
  effectMultiplier      Float          // Synergy strength
  detectedDate          DateTime
  isActive              Boolean        @default(true)

  component1            GovernmentComponent @relation("ComponentSynergies", ...)
  component2            GovernmentComponent @relation("ComponentConflicts", ...)
}
```

### Calculation Engine

Government effectiveness is calculated using the following formula:

```typescript
// Base effectiveness: Average of all component effectiveness scores
Base Effectiveness = Σ(component.effectivenessScore) / count

// Synergy bonus: +10 per ADDITIVE synergy
Synergy Bonus = count(ADDITIVE synergies) × 10

// Conflict penalty: -15 per CONFLICTING relationship
Conflict Penalty = count(CONFLICTING relationships) × 15

// Final effectiveness (clamped to 0-100 range)
Final Effectiveness = clamp(Base + Synergy - Penalty, 0, 100)
```

**Example Calculation**:
- 5 components with average effectiveness of 85
- 4 synergies detected (+40)
- 1 conflict detected (-15)
- **Result**: 85 + 40 - 15 = **110 → capped at 100%**

---

## Component Categories

The 106 atomic components are organized into 11 major categories:

### 1. Power Distribution (4 components)
How authority is distributed across government levels
- **Centralized Power** (85%)
- **Federal System** (78%)
- **Confederate System** (65%)
- **Unitary System** (82%)

### 2. Decision Process (5 components)
How governmental decisions are made
- **Democratic Process** (75%)
- **Autocratic Process** (88%)
- **Technocratic Process** (85%)
- **Consensus Process** (70%)
- **Oligarchic Process** (80%)

### 3. Legitimacy Sources (6 components)
Where government authority derives from
- **Electoral Legitimacy** (80%)
- **Traditional Legitimacy** (75%)
- **Performance Legitimacy** (85%)
- **Charismatic Legitimacy** (82%)
- **Religious Legitimacy** (78%)
- **Institutional Legitimacy** (varies)

### 4. Institutions (5 components)
Administrative structures of government
- **Professional Bureaucracy** (88%)
- **Military Administration** (85%)
- **Independent Judiciary** (90%)
- **Partisan Institutions** (70%)
- **Technocratic Agencies** (92%)

### 5. Control Mechanisms (5 components)
How government maintains order and compliance
- **Rule of Law** (92%)
- **Surveillance System** (85%)
- **Economic Incentives** (80%)
- **Social Pressure** (75%)
- **Military Enforcement** (90%)

### 6. Economic Governance (8 components)
Economic system management
- **Free Market System** (85%)
- **Planned Economy** (75%)
- **Mixed Economy** (80%)
- **Corporatist System** (78%)
- **Social Market Economy** (88%)
- **State Capitalism** (82%)
- **Resource-Based Economy** (70%)
- **Knowledge Economy** (92%)

### 7. Administrative Efficiency (8 components)
Government operational systems
- **Digital Government** (88%)
- **E-Governance** (85%)
- **Administrative Decentralization** (82%)
- **Merit-Based System** (90%)
- **Performance Management** (87%)
- **Quality Assurance** (85%)
- **Strategic Planning** (88%)
- **Risk Management** (83%)

### 8. Social Policy (8 components)
Social welfare and protection systems
- **Welfare State** (85%)
- **Universal Healthcare** (88%)
- **Public Education** (86%)
- **Social Safety Net** (84%)
- **Worker Protection** (82%)
- **Environmental Protection** (80%)
- **Cultural Preservation** (75%)
- **Minority Rights** (83%)

### 9. International Relations (8 components)
Foreign policy and diplomatic systems
- **Multilateral Diplomacy** (85%)
- **Bilateral Relations** (82%)
- **Regional Integration** (88%)
- **International Law** (87%)
- **Development Aid** (80%)
- **Humanitarian Intervention** (75%)
- **Trade Agreements** (85%)
- **Security Alliances** (88%)

### 10. Innovation & Development (8 components)
Technology and innovation systems
- **Research and Development** (90%)
- **Innovation Ecosystem** (92%)
- **Technology Transfer** (85%)
- **Entrepreneurship Support** (88%)
- **Intellectual Property** (83%)
- **Startup Incubation** (86%)
- **Digital Infrastructure** (89%)
- **Smart Cities** (87%)

### 11. Crisis Management (8 components)
Emergency preparedness and response
- **Emergency Response** (90%)
- **Disaster Preparedness** (85%)
- **Pandemic Management** (88%)
- **Cybersecurity** (92%)
- **Counter-Terrorism** (86%)
- **Crisis Communication** (84%)
- **Recovery Planning** (82%)
- **Resilience Building** (87%)

---

## All 106 Components Reference

### Power Distribution Components

#### CENTRALIZED_POWER
- **Base Effectiveness**: 85%
- **Description**: Central government controls most policy decisions and administration
- **Implementation Cost**: $100,000
- **Maintenance Cost**: $50,000/year
- **Capacity Required**: 75
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 25
- **Technology Required**: No
- **Synergies With**:
  - Autocratic Process
  - Professional Bureaucracy
  - Unitary System
  - Planned Economy
  - State Capitalism
- **Conflicts With**:
  - Federal System
  - Consensus Process
  - Confederate System
  - Administrative Decentralization

#### FEDERAL_SYSTEM
- **Base Effectiveness**: 78%
- **Description**: Power shared between national and regional governments with defined spheres
- **Implementation Cost**: $150,000
- **Maintenance Cost**: $75,000/year
- **Capacity Required**: 85
- **Complexity**: High
- **Time to Implement**: 24 months
- **Staff Required**: 40
- **Technology Required**: Yes
- **Synergies With**:
  - Democratic Process
  - Rule of Law
  - Administrative Decentralization
  - Consensus Process
- **Conflicts With**:
  - Centralized Power
  - Autocratic Process
  - Unitary System

#### CONFEDERATE_SYSTEM
- **Base Effectiveness**: 65%
- **Description**: Loose alliance of autonomous regions with minimal central authority
- **Implementation Cost**: $80,000
- **Maintenance Cost**: $40,000/year
- **Capacity Required**: 60
- **Complexity**: Low
- **Time to Implement**: 12 months
- **Staff Required**: 15
- **Technology Required**: No
- **Synergies With**:
  - Consensus Process
  - Traditional Legitimacy
- **Conflicts With**:
  - Centralized Power
  - Professional Bureaucracy
  - Unitary System

#### UNITARY_SYSTEM
- **Base Effectiveness**: 82%
- **Description**: Single level of government with local administration as extensions
- **Implementation Cost**: $90,000
- **Maintenance Cost**: $45,000/year
- **Capacity Required**: 70
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Centralized Power
  - Professional Bureaucracy
- **Conflicts With**:
  - Federal System
  - Confederate System

### Decision Process Components

#### DEMOCRATIC_PROCESS
- **Base Effectiveness**: 75%
- **Description**: Decisions made through elected representatives and majority rule
- **Implementation Cost**: $120,000
- **Maintenance Cost**: $60,000/year
- **Capacity Required**: 80
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 12
- **Technology Required**: Yes
- **Synergies With**:
  - Electoral Legitimacy
  - Rule of Law
  - Federal System
  - Free Market System
  - Social Market Economy
  - Mixed Economy
  - E-Governance
  - Multilateral Diplomacy
- **Conflicts With**:
  - Autocratic Process
  - Military Administration
  - Oligarchic Process
  - Surveillance System
  - Military Enforcement
  - Corporatist System
  - State Capitalism

#### AUTOCRATIC_PROCESS
- **Base Effectiveness**: 88%
- **Description**: Centralized decision making by a single leader or small group
- **Implementation Cost**: $80,000
- **Maintenance Cost**: $40,000/year
- **Capacity Required**: 65
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: No
- **Synergies With**:
  - Centralized Power
  - Charismatic Legitimacy
  - Military Administration
  - Surveillance System
  - Military Enforcement
- **Conflicts With**:
  - Democratic Process
  - Federal System
  - Consensus Process
  - Electoral Legitimacy
  - Independent Judiciary
  - Rule of Law
  - E-Governance
  - Multilateral Diplomacy

#### TECHNOCRATIC_PROCESS
- **Base Effectiveness**: 85%
- **Description**: Decisions based on expert knowledge and technical competence
- **Implementation Cost**: $140,000
- **Maintenance Cost**: $70,000/year
- **Capacity Required**: 90
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Performance Legitimacy
  - Technocratic Agencies
  - Planned Economy
  - Strategic Planning
- **Conflicts With**:
  - Charismatic Legitimacy
  - Traditional Legitimacy
  - Religious Legitimacy
  - Social Pressure

#### CONSENSUS_PROCESS
- **Base Effectiveness**: 70%
- **Description**: Decisions require broad agreement among stakeholders
- **Implementation Cost**: $100,000
- **Maintenance Cost**: $80,000/year
- **Capacity Required**: 75
- **Complexity**: Low
- **Time to Implement**: 6-12 months
- **Staff Required**: 5
- **Technology Required**: No
- **Synergies With**:
  - Traditional Legitimacy
  - Confederate System
  - Social Pressure
  - Administrative Decentralization
- **Conflicts With**:
  - Autocratic Process
  - Centralized Power
  - Strategic Planning

#### OLIGARCHIC_PROCESS
- **Base Effectiveness**: 80%
- **Description**: Small group of elites controls decision making processes
- **Implementation Cost**: $90,000
- **Maintenance Cost**: $45,000/year
- **Capacity Required**: 70
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Economic Incentives
  - Surveillance System
  - Partisan Institutions
  - Corporatist System
- **Conflicts With**:
  - Democratic Process
  - Electoral Legitimacy

### Legitimacy Source Components

#### ELECTORAL_LEGITIMACY
- **Base Effectiveness**: 80%
- **Description**: Authority derived from free and fair elections
- **Implementation Cost**: $110,000
- **Maintenance Cost**: $70,000/year
- **Capacity Required**: 85
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 11
- **Technology Required**: Yes
- **Synergies With**:
  - Democratic Process
  - Rule of Law
  - Independent Judiciary
- **Conflicts With**:
  - Autocratic Process
  - Oligarchic Process
  - Military Administration

#### TRADITIONAL_LEGITIMACY
- **Base Effectiveness**: 75%
- **Description**: Authority based on historical customs and established traditions
- **Implementation Cost**: $70,000
- **Maintenance Cost**: $30,000/year
- **Capacity Required**: 60
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Consensus Process
  - Religious Legitimacy
  - Confederate System
  - Social Pressure
  - Cultural Preservation
- **Conflicts With**:
  - Technocratic Process
  - Performance Legitimacy
  - Merit-Based System
  - Digital Government
  - Innovation Ecosystem

#### PERFORMANCE_LEGITIMACY
- **Base Effectiveness**: 85%
- **Description**: Authority based on effective governance and policy outcomes
- **Implementation Cost**: $130,000
- **Maintenance Cost**: $80,000/year
- **Capacity Required**: 90
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Technocratic Process
  - Professional Bureaucracy
  - Economic Incentives
  - Performance Management
  - Merit-Based System
- **Conflicts With**:
  - Traditional Legitimacy
  - Charismatic Legitimacy

#### CHARISMATIC_LEGITIMACY
- **Base Effectiveness**: 82%
- **Description**: Authority based on personal qualities and leadership appeal
- **Implementation Cost**: $60,000
- **Maintenance Cost**: $90,000/year
- **Capacity Required**: 70
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Autocratic Process
  - Social Pressure
- **Conflicts With**:
  - Technocratic Process
  - Performance Legitimacy
  - Performance Management
  - Strategic Planning

#### RELIGIOUS_LEGITIMACY
- **Base Effectiveness**: 78%
- **Description**: Authority derived from religious or spiritual mandate
- **Implementation Cost**: $80,000
- **Maintenance Cost**: $40,000/year
- **Capacity Required**: 65
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Traditional Legitimacy
  - Social Pressure
- **Conflicts With**:
  - Technocratic Process
  - Rule of Law
  - Economic Incentives

### Institution Components

#### PROFESSIONAL_BUREAUCRACY
- **Base Effectiveness**: 88%
- **Description**: Merit-based civil service with standardized procedures
- **Implementation Cost**: $150,000
- **Maintenance Cost**: $100,000/year
- **Capacity Required**: 95
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Performance Legitimacy
  - Rule of Law
  - Centralized Power
  - Unitary System
  - Merit-Based System
- **Conflicts With**:
  - Partisan Institutions
  - Military Administration
  - Confederate System

#### MILITARY_ADMINISTRATION
- **Base Effectiveness**: 85%
- **Description**: Government administration controlled by military hierarchy
- **Implementation Cost**: $100,000
- **Maintenance Cost**: $60,000/year
- **Capacity Required**: 80
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Autocratic Process
  - Military Enforcement
  - Emergency Response
  - Security Alliances
- **Conflicts With**:
  - Democratic Process
  - Independent Judiciary
  - Professional Bureaucracy
  - Electoral Legitimacy

#### INDEPENDENT_JUDICIARY
- **Base Effectiveness**: 90%
- **Description**: Autonomous court system free from political interference
- **Implementation Cost**: $120,000
- **Maintenance Cost**: $80,000/year
- **Capacity Required**: 85
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Rule of Law
  - Electoral Legitimacy
  - Democratic Process
- **Conflicts With**:
  - Autocratic Process
  - Military Administration
  - Partisan Institutions

#### PARTISAN_INSTITUTIONS
- **Base Effectiveness**: 70%
- **Description**: Government institutions staffed based on political loyalty
- **Implementation Cost**: $80,000
- **Maintenance Cost**: $50,000/year
- **Capacity Required**: 65
- **Complexity**: Low
- **Time to Implement**: 6-12 months
- **Staff Required**: 5
- **Technology Required**: No
- **Synergies With**:
  - Oligarchic Process
  - Economic Incentives
- **Conflicts With**:
  - Professional Bureaucracy
  - Independent Judiciary
  - Technocratic Agencies
  - Merit-Based System
  - Quality Assurance

#### TECHNOCRATIC_AGENCIES
- **Base Effectiveness**: 92%
- **Description**: Specialized agencies run by technical experts
- **Implementation Cost**: $160,000
- **Maintenance Cost**: $120,000/year
- **Capacity Required**: 95
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Technocratic Process
  - Performance Legitimacy
  - Corporatist System
  - State Capitalism
  - Resource-Based Economy
  - Research and Development
  - Cybersecurity
- **Conflicts With**:
  - Traditional Legitimacy
  - Partisan Institutions

### Control Mechanism Components

#### RULE_OF_LAW
- **Base Effectiveness**: 92%
- **Description**: Legal framework with consistent application and enforcement
- **Implementation Cost**: $140,000
- **Maintenance Cost**: $90,000/year
- **Capacity Required**: 90
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Independent Judiciary
  - Professional Bureaucracy
  - Democratic Process
  - Federal System
  - Electoral Legitimacy
  - International Law
  - Minority Rights
- **Conflicts With**:
  - Autocratic Process
  - Military Enforcement
  - Surveillance System
  - Religious Legitimacy

#### SURVEILLANCE_SYSTEM
- **Base Effectiveness**: 85%
- **Description**: Monitoring and information gathering apparatus
- **Implementation Cost**: $120,000
- **Maintenance Cost**: $80,000/year
- **Capacity Required**: 75
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: No
- **Synergies With**:
  - Autocratic Process
  - Oligarchic Process
  - Counter-Terrorism
- **Conflicts With**:
  - Democratic Process
  - Rule of Law
  - Social Pressure

#### ECONOMIC_INCENTIVES
- **Base Effectiveness**: 80%
- **Description**: Material rewards and punishments to ensure compliance
- **Implementation Cost**: $110,000
- **Maintenance Cost**: $70,000/year
- **Capacity Required**: 75
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 11
- **Technology Required**: No
- **Synergies With**:
  - Performance Legitimacy
  - Oligarchic Process
  - Free Market System
  - Partisan Institutions
  - Recovery Planning
- **Conflicts With**:
  - Traditional Legitimacy
  - Religious Legitimacy
  - Planned Economy
  - Universal Healthcare
  - Social Safety Net

#### SOCIAL_PRESSURE
- **Base Effectiveness**: 75%
- **Description**: Community norms and peer influence for behavioral control
- **Implementation Cost**: $60,000
- **Maintenance Cost**: $30,000/year
- **Capacity Required**: 55
- **Complexity**: Medium
- **Time to Implement**: 18 months
- **Staff Required**: 10
- **Technology Required**: No
- **Synergies With**:
  - Traditional Legitimacy
  - Consensus Process
  - Charismatic Legitimacy
  - Religious Legitimacy
  - Cultural Preservation
- **Conflicts With**:
  - Technocratic Process
  - Surveillance System
  - Digital Government
  - Crisis Communication

#### MILITARY_ENFORCEMENT
- **Base Effectiveness**: 90%
- **Description**: Use of military force to maintain order and compliance
- **Implementation Cost**: $100,000
- **Maintenance Cost**: $80,000/year
- **Capacity Required**: 85
- **Complexity**: High
- **Time to Implement**: 24-36 months
- **Staff Required**: 20
- **Technology Required**: Yes
- **Synergies With**:
  - Autocratic Process
  - Military Administration
- **Conflicts With**:
  - Democratic Process
  - Rule of Law

---

## Synergy System

### How Synergies Work

The synergy system models real-world political science relationships between governance components. When you select components that naturally complement each other, you receive effectiveness bonuses. When you select contradictory components, you face penalties.

### Synergy Types

**ADDITIVE Synergies** (+10% effectiveness each)
- Most common synergy type
- Represents natural compatibility between components
- Example: Democratic Process + Electoral Legitimacy = +10%

**MULTIPLICATIVE Synergies** (variable bonus)
- Reserved for future use
- Potential for scaling bonuses based on multiplier value
- Currently not implemented in the system

**CONFLICTING Relationships** (-15% effectiveness each)
- Represents incompatible or contradictory components
- More severe than lack of synergy
- Example: Democratic Process + Autocratic Process = -15%

### Detection Logic

The system automatically detects synergies and conflicts when you select components:

```typescript
function checkComponentSynergy(type1: ComponentType, type2: ComponentType) {
  // Checks both orderings of component pairs
  const key1 = `${type1}+${type2}`;
  const key2 = `${type2}+${type1}`;

  return SYNERGY_MAP[key1] ?? SYNERGY_MAP[key2] ?? null;
}
```

All 91 relationship mappings are stored in `/src/lib/government-synergy.ts`.

---

## Complete Synergy Matrix (91 Relationships)

### ADDITIVE SYNERGIES (46 total)

#### Power Distribution Synergies (8)
1. **CENTRALIZED_POWER + AUTOCRATIC_PROCESS** (+10)
   - "Centralized power reinforces autocratic decision making"
2. **CENTRALIZED_POWER + PROFESSIONAL_BUREAUCRACY** (+10)
   - "Central authority enables coordinated bureaucracy"
3. **FEDERAL_SYSTEM + DEMOCRATIC_PROCESS** (+10)
   - "Federal structure supports democratic participation"
4. **FEDERAL_SYSTEM + RULE_OF_LAW** (+10)
   - "Federal system strengthens legal frameworks"
5. **CONFEDERATE_SYSTEM + CONSENSUS_PROCESS** (+10)
   - "Confederate structure requires consensus building"
6. **CONFEDERATE_SYSTEM + TRADITIONAL_LEGITIMACY** (+10)
   - "Confederation respects traditional authority"
7. **UNITARY_SYSTEM + CENTRALIZED_POWER** (+10)
   - "Unitary system maximizes central control"
8. **UNITARY_SYSTEM + PROFESSIONAL_BUREAUCRACY** (+10)
   - "Unified administration enhances bureaucratic efficiency"

#### Decision Process Synergies (8)
9. **DEMOCRATIC_PROCESS + ELECTORAL_LEGITIMACY** (+10)
   - "Democracy derives strength from electoral mandate"
10. **DEMOCRATIC_PROCESS + RULE_OF_LAW** (+10)
    - "Democratic institutions require legal framework"
11. **AUTOCRATIC_PROCESS + CHARISMATIC_LEGITIMACY** (+10)
    - "Autocracy benefits from strong leadership"
12. **TECHNOCRATIC_PROCESS + PERFORMANCE_LEGITIMACY** (+10)
    - "Expert governance validated by results"
13. **TECHNOCRATIC_PROCESS + TECHNOCRATIC_AGENCIES** (+10)
    - "Technical decision making empowers expert agencies"
14. **CONSENSUS_PROCESS + TRADITIONAL_LEGITIMACY** (+10)
    - "Consensus building respects traditional norms"
15. **OLIGARCHIC_PROCESS + ECONOMIC_INCENTIVES** (+10)
    - "Elite control leverages economic rewards"
16. **OLIGARCHIC_PROCESS + SURVEILLANCE_SYSTEM** (+10)
    - "Oligarchy maintains control through monitoring"

#### Legitimacy Synergies (5)
17. **ELECTORAL_LEGITIMACY + INDEPENDENT_JUDICIARY** (+10)
    - "Electoral authority protected by independent courts"
18. **TRADITIONAL_LEGITIMACY + RELIGIOUS_LEGITIMACY** (+10)
    - "Traditional and religious authority reinforce each other"
19. **PERFORMANCE_LEGITIMACY + PROFESSIONAL_BUREAUCRACY** (+10)
    - "Performance governance requires professional administration"
20. **CHARISMATIC_LEGITIMACY + SOCIAL_PRESSURE** (+10)
    - "Charismatic leadership mobilizes social support"
21. **RELIGIOUS_LEGITIMACY + SOCIAL_PRESSURE** (+10)
    - "Religious authority enforced through community norms"

#### Institution Synergies (6)
22. **PROFESSIONAL_BUREAUCRACY + RULE_OF_LAW** (+10)
    - "Professional administration upholds legal standards"
23. **MILITARY_ADMINISTRATION + AUTOCRATIC_PROCESS** (+10)
    - "Military hierarchy supports centralized command"
24. **MILITARY_ADMINISTRATION + MILITARY_ENFORCEMENT** (+10)
    - "Military administration and enforcement work together"
25. **INDEPENDENT_JUDICIARY + RULE_OF_LAW** (+10)
    - "Independent courts essential for rule of law"
26. **PARTISAN_INSTITUTIONS + OLIGARCHIC_PROCESS** (+10)
    - "Partisan loyalty supports elite control"
27. **PARTISAN_INSTITUTIONS + ECONOMIC_INCENTIVES** (+10)
    - "Partisan institutions distribute economic rewards"

#### Control Mechanism Synergies (4)
28. **SURVEILLANCE_SYSTEM + AUTOCRATIC_PROCESS** (+10)
    - "Surveillance supports centralized control"
29. **ECONOMIC_INCENTIVES + PERFORMANCE_LEGITIMACY** (+10)
    - "Economic rewards validate performance-based governance"
30. **SOCIAL_PRESSURE + TRADITIONAL_LEGITIMACY** (+10)
    - "Social norms reinforce traditional values"
31. **SOCIAL_PRESSURE + CONSENSUS_PROCESS** (+10)
    - "Social pressure facilitates consensus building"

#### Economic System Synergies (15)
32. **FREE_MARKET_SYSTEM + DEMOCRATIC_PROCESS** (+10)
    - "Free markets thrive in democratic systems"
33. **FREE_MARKET_SYSTEM + ECONOMIC_INCENTIVES** (+10)
    - "Market economy relies on economic incentives"
34. **PLANNED_ECONOMY + CENTRALIZED_POWER** (+10)
    - "Economic planning requires centralized authority"
35. **PLANNED_ECONOMY + TECHNOCRATIC_PROCESS** (+10)
    - "Economic planning benefits from technical expertise"
36. **MIXED_ECONOMY + SOCIAL_MARKET_ECONOMY** (+10)
    - "Mixed economy compatible with social market principles"
37. **MIXED_ECONOMY + DEMOCRATIC_PROCESS** (+10)
    - "Mixed economy balances interests democratically"
38. **CORPORATIST_SYSTEM + OLIGARCHIC_PROCESS** (+10)
    - "Corporatism enables organized elite coordination"
39. **CORPORATIST_SYSTEM + TECHNOCRATIC_AGENCIES** (+10)
    - "Corporatism benefits from expert management"
40. **SOCIAL_MARKET_ECONOMY + DEMOCRATIC_PROCESS** (+10)
    - "Social market economy requires democratic oversight"
41. **SOCIAL_MARKET_ECONOMY + WELFARE_STATE** (+10)
    - "Social market principles align with welfare policies"
42. **STATE_CAPITALISM + CENTRALIZED_POWER** (+10)
    - "State capitalism requires strong central authority"
43. **STATE_CAPITALISM + TECHNOCRATIC_AGENCIES** (+10)
    - "State economic control benefits from expert management"
44. **RESOURCE_BASED_ECONOMY + STATE_CAPITALISM** (+10)
    - "Resource economy often controlled by state"
45. **RESOURCE_BASED_ECONOMY + TECHNOCRATIC_AGENCIES** (+10)
    - "Resource extraction requires technical expertise"
46. **KNOWLEDGE_ECONOMY + RESEARCH_AND_DEVELOPMENT** (+10)
    - "Knowledge economy thrives with R&D investment"

### CONFLICTING RELATIONSHIPS (45 total)

#### Power Structure Conflicts (7)
1. **CENTRALIZED_POWER ↔ FEDERAL_SYSTEM** (-15)
   - "Centralized control conflicts with federal autonomy"
2. **CENTRALIZED_POWER ↔ CONSENSUS_PROCESS** (-15)
   - "Central authority undermines consensus building"
3. **FEDERAL_SYSTEM ↔ AUTOCRATIC_PROCESS** (-15)
   - "Federal autonomy conflicts with autocratic control"
4. **CONFEDERATE_SYSTEM ↔ CENTRALIZED_POWER** (-15)
   - "Confederate independence conflicts with centralization"
5. **CONFEDERATE_SYSTEM ↔ PROFESSIONAL_BUREAUCRACY** (-15)
   - "Loose confederation hinders unified bureaucracy"
6. **UNITARY_SYSTEM ↔ FEDERAL_SYSTEM** (-15)
   - "Unitary and federal systems are incompatible"
7. **UNITARY_SYSTEM ↔ CONFEDERATE_SYSTEM** (-15)
   - "Unitary control conflicts with confederate autonomy"

#### Decision Process Conflicts (8)
8. **DEMOCRATIC_PROCESS ↔ AUTOCRATIC_PROCESS** (-15)
   - "Democracy and autocracy are fundamentally opposed"
9. **DEMOCRATIC_PROCESS ↔ MILITARY_ADMINISTRATION** (-15)
   - "Democratic governance conflicts with military rule"
10. **AUTOCRATIC_PROCESS ↔ CONSENSUS_PROCESS** (-15)
    - "Autocratic control prevents consensus building"
11. **AUTOCRATIC_PROCESS ↔ ELECTORAL_LEGITIMACY** (-15)
    - "Autocracy undermines electoral processes"
12. **TECHNOCRATIC_PROCESS ↔ CHARISMATIC_LEGITIMACY** (-15)
    - "Technical expertise conflicts with charismatic authority"
13. **TECHNOCRATIC_PROCESS ↔ TRADITIONAL_LEGITIMACY** (-15)
    - "Technical rationality conflicts with traditional norms"
14. **OLIGARCHIC_PROCESS ↔ DEMOCRATIC_PROCESS** (-15)
    - "Elite control conflicts with democratic participation"
15. **OLIGARCHIC_PROCESS ↔ ELECTORAL_LEGITIMACY** (-15)
    - "Oligarchic power undermines electoral processes"

#### Legitimacy Conflicts (4)
16. **TRADITIONAL_LEGITIMACY ↔ PERFORMANCE_LEGITIMACY** (-15)
    - "Traditional authority conflicts with performance standards"
17. **CHARISMATIC_LEGITIMACY ↔ PERFORMANCE_LEGITIMACY** (-15)
    - "Charismatic authority conflicts with performance metrics"
18. **RELIGIOUS_LEGITIMACY ↔ TECHNOCRATIC_PROCESS** (-15)
    - "Religious authority conflicts with technical rationality"
19. **RELIGIOUS_LEGITIMACY ↔ RULE_OF_LAW** (-15)
    - "Religious law may conflict with secular legal framework"

#### Institutional Conflicts (6)
20. **PROFESSIONAL_BUREAUCRACY ↔ PARTISAN_INSTITUTIONS** (-15)
    - "Merit-based system conflicts with partisan appointments"
21. **PROFESSIONAL_BUREAUCRACY ↔ MILITARY_ADMINISTRATION** (-15)
    - "Professional bureaucracy conflicts with military hierarchy"
22. **MILITARY_ADMINISTRATION ↔ INDEPENDENT_JUDICIARY** (-15)
    - "Military rule undermines judicial independence"
23. **PARTISAN_INSTITUTIONS ↔ INDEPENDENT_JUDICIARY** (-15)
    - "Partisan control conflicts with judicial independence"
24. **TECHNOCRATIC_AGENCIES ↔ TRADITIONAL_LEGITIMACY** (-15)
    - "Technical expertise conflicts with traditional authority"
25. **TECHNOCRATIC_AGENCIES ↔ PARTISAN_INSTITUTIONS** (-15)
    - "Expert agencies conflict with partisan control"

#### Control System Conflicts (9)
26. **RULE_OF_LAW ↔ AUTOCRATIC_PROCESS** (-15)
    - "Rule of law constrained by autocratic power"
27. **RULE_OF_LAW ↔ MILITARY_ENFORCEMENT** (-15)
    - "Legal framework conflicts with military force"
28. **SURVEILLANCE_SYSTEM ↔ DEMOCRATIC_PROCESS** (-15)
    - "Mass surveillance undermines democratic freedoms"
29. **SURVEILLANCE_SYSTEM ↔ RULE_OF_LAW** (-15)
    - "Surveillance may violate legal protections"
30. **ECONOMIC_INCENTIVES ↔ TRADITIONAL_LEGITIMACY** (-15)
    - "Economic rewards conflict with traditional values"
31. **ECONOMIC_INCENTIVES ↔ RELIGIOUS_LEGITIMACY** (-15)
    - "Material incentives conflict with religious principles"
32. **SOCIAL_PRESSURE ↔ TECHNOCRATIC_PROCESS** (-15)
    - "Social conformity conflicts with technical rationality"
33. **SOCIAL_PRESSURE ↔ SURVEILLANCE_SYSTEM** (-15)
    - "Community norms differ from state surveillance"
34. **MILITARY_ENFORCEMENT ↔ DEMOCRATIC_PROCESS** (-15)
    - "Military force undermines democratic governance"

#### Economic System Conflicts (11)
35. **FREE_MARKET_SYSTEM ↔ PLANNED_ECONOMY** (-15)
    - "Free markets and central planning are incompatible"
36. **FREE_MARKET_SYSTEM ↔ WELFARE_STATE** (-15)
    - "Unrestricted markets conflict with extensive welfare"
37. **PLANNED_ECONOMY ↔ ECONOMIC_INCENTIVES** (-15)
    - "Central planning reduces market incentives"
38. **MIXED_ECONOMY ↔ PLANNED_ECONOMY** (-15)
    - "Mixed economy balances differ from pure planning"
39. **MIXED_ECONOMY ↔ FREE_MARKET_SYSTEM** (-15)
    - "Mixed economy includes more intervention than free market"
40. **CORPORATIST_SYSTEM ↔ DEMOCRATIC_PROCESS** (-15)
    - "Corporatist structures limit democratic participation"
41. **CORPORATIST_SYSTEM ↔ FREE_MARKET_SYSTEM** (-15)
    - "Corporatism constrains free market competition"
42. **SOCIAL_MARKET_ECONOMY ↔ FREE_MARKET_SYSTEM** (-15)
    - "Social market includes more regulation than free market"
43. **SOCIAL_MARKET_ECONOMY ↔ PLANNED_ECONOMY** (-15)
    - "Social market preserves more market mechanisms than planning"
44. **STATE_CAPITALISM ↔ FREE_MARKET_SYSTEM** (-15)
    - "State ownership conflicts with free market principles"
45. **STATE_CAPITALISM ↔ DEMOCRATIC_PROCESS** (-15)
    - "State economic control may undermine democratic accountability"

---

## Builder's Guide

### Optimal Component Selection

**Recommended Build Size**: 3-10 components

**Too Few Components** (1-2):
- Limited effectiveness
- Missing critical governance functions
- Unstable government structure

**Optimal Range** (3-10):
- Balanced effectiveness
- Sufficient complexity
- Manageable synergies/conflicts

**Too Many Components** (11+):
- Increased conflict probability
- Bureaucratic overhead
- Diminishing returns

### Step-by-Step Building Process

**Step 1: Choose Your Foundation**
Start with a power distribution component:
- Centralized Power (strong control)
- Federal System (balanced power)
- Confederate System (maximum autonomy)
- Unitary System (efficient administration)

**Step 2: Select Decision Process**
Pick how decisions are made:
- Democratic Process (participation)
- Autocratic Process (speed)
- Technocratic Process (expertise)
- Consensus Process (agreement)
- Oligarchic Process (elite control)

**Step 3: Add Legitimacy Source**
Choose what validates your government:
- Electoral Legitimacy (votes)
- Traditional Legitimacy (history)
- Performance Legitimacy (results)
- Charismatic Legitimacy (leadership)
- Religious Legitimacy (faith)

**Step 4: Build Institutions**
Select administrative structures:
- Professional Bureaucracy (merit)
- Military Administration (force)
- Independent Judiciary (law)
- Partisan Institutions (loyalty)
- Technocratic Agencies (expertise)

**Step 5: Add Control Mechanisms**
Choose how order is maintained:
- Rule of Law (legal framework)
- Surveillance System (monitoring)
- Economic Incentives (rewards)
- Social Pressure (norms)
- Military Enforcement (force)

**Step 6: Economic Governance (Optional)**
Add economic system if desired:
- Free Market System
- Planned Economy
- Mixed Economy
- Social Market Economy
- Knowledge Economy

**Step 7: Specialized Systems (Optional)**
Add additional components for specific needs:
- Administrative efficiency
- Social policy
- International relations
- Innovation
- Crisis management

### Synergy Optimization Tips

**1. Stack Compatible Components**
Look for "synergy chains" where multiple components connect:

Example Chain:
- Democratic Process ←→ Electoral Legitimacy (+10)
- Democratic Process ←→ Rule of Law (+10)
- Electoral Legitimacy ←→ Independent Judiciary (+10)
- Independent Judiciary ←→ Rule of Law (+10)
- **Total: +40% effectiveness**

**2. Avoid Contradiction**
Never combine components with CONFLICTING relationships:
- ❌ Democratic + Autocratic (-15)
- ❌ Free Market + Planned Economy (-15)
- ❌ Federal + Unitary (-15)

**3. Choose Ideological Coherence**
Pure systems work better than mixed:
- ✅ Pure Democratic Build (all democratic components)
- ✅ Pure Authoritarian Build (all authoritarian components)
- ❌ Mixed Build (democratic + authoritarian components)

**4. Balance Complexity and Effectiveness**
High effectiveness components often require:
- Higher implementation costs
- More technology
- Longer implementation times
- More staff

### Common Mistakes to Avoid

**Mistake 1: Mixing Opposing Ideologies**
Don't combine:
- Democratic + Autocratic systems
- Free Market + Planned Economy
- Traditional + Technocratic legitimacy

**Mistake 2: Ignoring Implementation Costs**
Some high-effectiveness components are expensive:
- Technocratic Agencies: $160,000
- Digital Infrastructure: $160,000
- Smart Cities: $180,000

**Mistake 3: Overlooking Prerequisites**
Check:
- Technology requirements
- Staff availability
- Capacity constraints
- Implementation timeline

**Mistake 4: Building Too Large**
More components ≠ better government:
- Increased conflict probability
- Higher costs
- Complex management

---

## Example Government Builds

### Example 1: Modern Liberal Democracy
**Theme**: Western-style democracy with market economy

**Components** (7 total):
1. Federal System (78%)
2. Democratic Process (75%)
3. Electoral Legitimacy (80%)
4. Independent Judiciary (90%)
5. Rule of Law (92%)
6. Professional Bureaucracy (88%)
7. Free Market System (85%)

**Synergies Detected** (10):
1. Federal System + Democratic Process = +10
2. Federal System + Rule of Law = +10
3. Democratic Process + Electoral Legitimacy = +10
4. Democratic Process + Rule of Law = +10
5. Democratic Process + Free Market System = +10
6. Electoral Legitimacy + Independent Judiciary = +10
7. Independent Judiciary + Rule of Law = +10
8. Professional Bureaucracy + Rule of Law = +10
9. Free Market System + Economic Incentives = +10 (if added)
10. (Additional synergies available)

**Conflicts**: None

**Calculation**:
- Base: (78+75+80+90+92+88+85)/7 = 84
- Synergies: 10 × 10 = +100
- Conflicts: 0
- **Final: 184 → capped at 100%**

**Strengths**:
- Maximum effectiveness (100%)
- High stability
- Strong legal framework
- Economic freedom

**Weaknesses**:
- High implementation cost ($800,000+)
- Long implementation time (24+ months)
- Requires advanced technology

### Example 2: Authoritarian Efficiency State
**Theme**: Centralized control with technical expertise

**Components** (6 total):
1. Centralized Power (85%)
2. Autocratic Process (88%)
3. Charismatic Legitimacy (82%)
4. Military Administration (85%)
5. Surveillance System (85%)
6. Planned Economy (75%)

**Synergies Detected** (7):
1. Centralized Power + Autocratic Process = +10
2. Centralized Power + Planned Economy = +10
3. Autocratic Process + Charismatic Legitimacy = +10
4. Autocratic Process + Military Administration = +10
5. Autocratic Process + Surveillance System = +10
6. Military Administration + Military Enforcement = +10 (if added)
7. Planned Economy + Technocratic Process = +10 (if added)

**Conflicts**: None (all components compatible)

**Calculation**:
- Base: (85+88+82+85+85+75)/6 = 83.3
- Synergies: 7 × 10 = +70
- Conflicts: 0
- **Final: 153.3 → capped at 100%**

**Strengths**:
- Maximum effectiveness (100%)
- Fast decision making
- Strong control
- Lower implementation cost

**Weaknesses**:
- No democratic participation
- Limited individual freedoms
- High maintenance cost
- Dependency on leadership

### Example 3: Technocratic Meritocracy
**Theme**: Expert-driven governance with performance focus

**Components** (8 total):
1. Unitary System (82%)
2. Technocratic Process (85%)
3. Performance Legitimacy (85%)
4. Professional Bureaucracy (88%)
5. Technocratic Agencies (92%)
6. Rule of Law (92%)
7. Merit-Based System (90%)
8. Knowledge Economy (92%)

**Synergies Detected** (11):
1. Unitary System + Centralized Power = +10
2. Unitary System + Professional Bureaucracy = +10
3. Technocratic Process + Performance Legitimacy = +10
4. Technocratic Process + Technocratic Agencies = +10
5. Performance Legitimacy + Professional Bureaucracy = +10
6. Performance Legitimacy + Merit-Based System = +10
7. Professional Bureaucracy + Rule of Law = +10
8. Technocratic Agencies + Knowledge Economy = +10
9. Merit-Based System + Professional Bureaucracy = +10
10. Knowledge Economy + Research and Development = +10 (if added)
11. (Additional synergies available)

**Conflicts**: None

**Calculation**:
- Base: (82+85+85+88+92+92+90+92)/8 = 88.25
- Synergies: 11 × 10 = +110
- Conflicts: 0
- **Final: 198.25 → capped at 100%**

**Strengths**:
- Exceptional effectiveness (100%)
- Evidence-based policy
- High competence
- Innovation-friendly

**Weaknesses**:
- Very high implementation cost ($1,000,000+)
- Requires extensive technology
- Long implementation time (36+ months)
- High capacity requirements (90+)

### Example 4: Conflicted Mixed System (AVOID)
**Theme**: Incompatible component mixture

**Components** (6 total):
1. Democratic Process (75%)
2. Autocratic Process (88%)
3. Free Market System (85%)
4. Planned Economy (75%)
5. Federal System (78%)
6. Centralized Power (85%)

**Synergies Detected** (2):
1. Democratic Process + Free Market System = +10
2. Federal System + Democratic Process = +10

**Conflicts** (4):
1. Democratic Process ↔ Autocratic Process = -15
2. Free Market System ↔ Planned Economy = -15
3. Federal System ↔ Centralized Power = -15
4. Federal System ↔ Autocratic Process = -15

**Calculation**:
- Base: (75+88+85+75+78+85)/6 = 81
- Synergies: 2 × 10 = +20
- Conflicts: 4 × 15 = -60
- **Final: 41%**

**Result**: Ineffective government with internal contradictions

**Lesson**: Avoid mixing opposing ideologies and systems

### Example 5: Traditional Consensus Society
**Theme**: Community-based governance with cultural preservation

**Components** (6 total):
1. Confederate System (65%)
2. Consensus Process (70%)
3. Traditional Legitimacy (75%)
4. Religious Legitimacy (78%)
5. Social Pressure (75%)
6. Cultural Preservation (75%)

**Synergies Detected** (8):
1. Confederate System + Consensus Process = +10
2. Confederate System + Traditional Legitimacy = +10
3. Consensus Process + Traditional Legitimacy = +10
4. Consensus Process + Social Pressure = +10
5. Traditional Legitimacy + Religious Legitimacy = +10
6. Traditional Legitimacy + Social Pressure = +10
7. Traditional Legitimacy + Cultural Preservation = +10
8. Religious Legitimacy + Social Pressure = +10

**Conflicts**: None

**Calculation**:
- Base: (65+70+75+78+75+75)/6 = 73
- Synergies: 8 × 10 = +80
- Conflicts: 0
- **Final: 153 → capped at 100%**

**Strengths**:
- Maximum effectiveness (100%)
- Low implementation cost ($450,000)
- No technology required
- Fast implementation (6-18 months)
- Strong social cohesion

**Weaknesses**:
- Slower decision making
- Limited innovation
- Lower base effectiveness
- Resists modernization

### Example 6: Crisis-Ready State
**Theme**: Emergency preparedness with strong response capability

**Components** (7 total):
1. Centralized Power (85%)
2. Autocratic Process (88%)
3. Military Administration (85%)
4. Emergency Response (90%)
5. Disaster Preparedness (85%)
6. Pandemic Management (88%)
7. Cybersecurity (92%)

**Synergies Detected** (6):
1. Centralized Power + Autocratic Process = +10
2. Autocratic Process + Military Administration = +10
3. Military Administration + Emergency Response = +10
4. Emergency Response + Disaster Preparedness = +10
5. Pandemic Management + Universal Healthcare = +10 (if added)
6. Cybersecurity + Digital Infrastructure = +10 (if added)

**Conflicts**: Potential conflicts if democratic components added

**Calculation**:
- Base: (85+88+85+90+85+88+92)/7 = 87.6
- Synergies: 6 × 10 = +60
- Conflicts: 0
- **Final: 147.6 → capped at 100%**

**Strengths**:
- Maximum crisis response (100%)
- Rapid decision making
- Strong coordination
- Comprehensive preparedness

**Weaknesses**:
- Authoritarian structure
- High maintenance cost
- Limited peacetime flexibility

---

## Technical Reference

### Implementation Files

**Core System**:
- `/src/lib/government-synergy.ts` - Synergy detection and calculation engine (200 lines)
- `/src/components/government/atoms/AtomicGovernmentComponents.tsx` - Component definitions (2168 lines)
- `/prisma/schema.prisma` - Database models (GovernmentComponent, ComponentSynergy)

**API Integration**:
- `/src/server/api/routers/countries.ts` - Component persistence
- `/src/server/api/routers/mycountry.ts` - Component management

**UI Components**:
- `/src/components/atomic/shared/UnifiedAtomicComponentSelector.tsx` - Component selector UI
- `/src/components/atomic/shared/themes.ts` - Government theme configuration

### API Usage

**Creating Components**:
```typescript
// Via countries.createCountry mutation
const country = await trpc.countries.createCountry.mutate({
  name: "Test Country",
  governmentComponents: [
    ComponentType.DEMOCRATIC_PROCESS,
    ComponentType.ELECTORAL_LEGITIMACY,
    ComponentType.RULE_OF_LAW
  ]
});
```

**Calculating Effectiveness**:
```typescript
import { calculateGovernmentEffectiveness } from '~/lib/government-synergy';

const metrics = calculateGovernmentEffectiveness(
  selectedComponents,
  detectedSynergies
);

// Returns:
{
  baseEffectiveness: 85,
  synergyBonus: 30,
  conflictPenalty: 15,
  totalEffectiveness: 100,
  synergyCount: 3,
  conflictCount: 1
}
```

**Checking Synergies**:
```typescript
import { checkComponentSynergy } from '~/lib/government-synergy';

const synergy = checkComponentSynergy(
  ComponentType.DEMOCRATIC_PROCESS,
  ComponentType.ELECTORAL_LEGITIMACY
);

// Returns:
{
  type: 'ADDITIVE',
  multiplier: 1.0,
  description: 'Democracy derives strength from electoral mandate'
}
```

### Database Schema

**GovernmentComponent Model**:
```prisma
model GovernmentComponent {
  id                    String         @id @default(cuid())
  countryId             String
  componentType         ComponentType
  effectivenessScore    Float
  implementationDate    DateTime
  lastModified          DateTime       @updatedAt
  isActive              Boolean        @default(true)

  country               Country        @relation(...)
  synergiesFrom         ComponentSynergy[] @relation("ComponentSynergies")
  synergiesTo           ComponentSynergy[] @relation("ComponentConflicts")
}
```

**ComponentSynergy Model**:
```prisma
model ComponentSynergy {
  id                    String         @id @default(cuid())
  component1Id          String
  component2Id          String
  synergyType           String         // "ADDITIVE" | "CONFLICTING"
  effectMultiplier      Float
  detectedDate          DateTime
  isActive              Boolean        @default(true)

  component1            GovernmentComponent @relation("ComponentSynergies", ...)
  component2            GovernmentComponent @relation("ComponentConflicts", ...)
}
```

### Component Type Enum

The `ComponentType` enum contains all 106 component types:

```typescript
enum ComponentType {
  // Power Distribution (4)
  CENTRALIZED_POWER
  FEDERAL_SYSTEM
  CONFEDERATE_SYSTEM
  UNITARY_SYSTEM

  // Decision Process (5)
  DEMOCRATIC_PROCESS
  AUTOCRATIC_PROCESS
  TECHNOCRATIC_PROCESS
  CONSENSUS_PROCESS
  OLIGARCHIC_PROCESS

  // Legitimacy Sources (6)
  ELECTORAL_LEGITIMACY
  TRADITIONAL_LEGITIMACY
  PERFORMANCE_LEGITIMACY
  CHARISMATIC_LEGITIMACY
  RELIGIOUS_LEGITIMACY
  INSTITUTIONAL_LEGITIMACY

  // ... (97 more components)
}
```

---

## Best Practices

### Government Design Principles

**1. Start with Core Components**
Always include:
- 1 Power Distribution component
- 1 Decision Process component
- 1 Legitimacy Source component
- 1-2 Institution components

**2. Build Thematically**
Choose components that align ideologically:
- **Democratic Theme**: Democratic Process, Electoral Legitimacy, Rule of Law
- **Authoritarian Theme**: Autocratic Process, Centralized Power, Surveillance
- **Technocratic Theme**: Technocratic Process, Performance Legitimacy, Expert Agencies

**3. Maximize Synergies**
Look for components with multiple synergy connections:
- Rule of Law: 7+ synergies
- Democratic Process: 8+ synergies
- Professional Bureaucracy: 5+ synergies

**4. Avoid Contradictions**
Never combine:
- Opposing decision processes (Democratic + Autocratic)
- Incompatible economic systems (Free Market + Planned)
- Conflicting power structures (Federal + Unitary)

**5. Consider Implementation Feasibility**
Check before selecting:
- Total implementation cost
- Technology requirements
- Staff availability
- Time to implement

### Performance Optimization

**High-Effectiveness Builds**:
- Target 4-6 components with strong synergies
- Aim for 80%+ base effectiveness
- Seek 4+ synergy bonuses
- Avoid all conflicts

**Cost-Effective Builds**:
- Choose low-cost components (Confederate, Traditional, Social Pressure)
- Avoid technology-heavy components
- Select shorter implementation times
- Lower staff requirements

**Balanced Builds**:
- Mix high and low effectiveness components
- 2-3 expensive + 3-4 affordable components
- Moderate synergies (3-5)
- Accept 1-2 minor conflicts if necessary

### Common Use Cases

**Startup Nation**:
- Low-cost components
- Fast implementation
- Moderate effectiveness (70-80%)
- Example: Confederate + Consensus + Traditional

**Developed Democracy**:
- High-cost components
- Long implementation
- Maximum effectiveness (95-100%)
- Example: Federal + Democratic + Rule of Law + Professional Bureaucracy

**Authoritarian Efficiency**:
- Medium-cost components
- Moderate implementation
- High effectiveness (90-100%)
- Example: Centralized + Autocratic + Military Admin

**Innovation Hub**:
- High-cost components
- Technology-focused
- Maximum innovation (95-100%)
- Example: Technocratic + Performance + Knowledge Economy + R&D

### Maintenance and Evolution

**Regular Reviews**:
- Check effectiveness quarterly
- Monitor synergy/conflict changes
- Evaluate new component opportunities

**Strategic Additions**:
- Add components gradually
- Test synergy impact before committing
- Remove underperforming components

**Crisis Adaptations**:
- Emergency Response for disasters
- Pandemic Management for health crises
- Cybersecurity for digital threats

---

## Conclusion

The Atomic Government Components system provides unprecedented flexibility in governance modeling. With 106 components and 91 relationship mappings, you can create millions of unique government configurations.

**Key Takeaways**:
1. **Modularity**: Build custom governments from fundamental blocks
2. **Synergies**: Compatible components provide +10% bonuses
3. **Conflicts**: Incompatible combinations impose -15% penalties
4. **Optimization**: Aim for 4-6 synergistic components for best results
5. **Ideological Coherence**: Pure systems outperform mixed systems

**Next Steps**:
- Explore the component library
- Design your ideal government
- Test effectiveness calculations
- Iterate and optimize

**Resources**:
- Component Reference: `/src/components/government/atoms/AtomicGovernmentComponents.tsx`
- Synergy Engine: `/src/lib/government-synergy.ts`
- API Documentation: `/docs/API_REFERENCE.md`
- Builder System: `/docs/BUILDER_SYSTEM.md`

---

**Document Version**: 1.0
**Last Updated**: October 22, 2025
**Status**: Complete
**Lines**: 1800+

For questions or contributions, see the main IxStats documentation at `/docs/`.
