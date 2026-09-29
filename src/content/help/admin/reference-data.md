---
title: Reference Data Management
description: Create, edit, and organize game content catalogs including government components, economic policies, military equipment, and diplomatic scenarios.
badge: For Admins
---

## Government Components

- **64 Atomic Components** across 10 categories: DEMOCRATIC_PROCESS, FEDERAL_SYSTEM, INDEPENDENT_JUDICIARY, etc.
- **Fields:** Name, description, category, effectiveness score (0-100), costs, prerequisites.
- **Synergies:** Define compatible components that boost effectiveness when combined.
- **Conflicts:** Mark incompatible combinations that reduce effectiveness or cause instability.
- Changes immediately reflected in the country builder component selector.

## Economic Components

> **27 Policy Components**
>
> - Categories: Economic Model, Sector Focus, Labor System, Trade Policy, Innovation, Resource Management.
> - Effects: GDP impact, employment, innovation index, sustainability, inequality.
> - Prerequisites: Prerequisite components and unlock conditions.
> - Formulas: Custom calculation expressions for dynamic economic modeling.

## Diplomatic Scenarios

> **100+ Scenario Templates**
>
> - **Categories:** Trade, cultural, security, crisis mediation, alliances.
> - **Triggers:** Relationship thresholds, random probability, event-driven.
> - **Response Options:** 2-5 choices with costs, benefits, NPC personality modifiers.
> - **Outcomes:** Relationship changes, economic effects, reputation shifts, resource transfers.

## Military Equipment

- **500+ Equipment Items:** Tanks, aircraft, ships, artillery, small arms.
- **Specifications:** Weight, crew, range, speed, armament, protection levels.
- **Manufacturers:** Origin country, production dates, license agreements.
- **Operational Data:** Maintenance costs, reliability, upgrade paths.

## NPC Personalities

- **8 Personality Traits:** Assertiveness, cooperativeness, economic focus, cultural openness, risk tolerance, ideological rigidity, militarism, isolationism.
- **Calculation Formulas:** Define how traits derive from observable data (alliances, conflicts, trade).
- **Archetypes:** 6 personality profiles (Pragmatic Realist, Peaceful Merchant, Aggressive Expansionist, Cultural Diplomat, Ideological Hardliner, Cautious Isolationist).
- **Drift Parameters:** Max annual change rates, influence factors.

## CRUD Operations

> **Standard Admin Workflow**
>
> 1. **Create:** Click "New \[Type\]" button, fill form, validate, save to database.
> 2. **Read:** Browse list view with filters, search, pagination; click to view details.
> 3. **Update:** Edit inline or via form; changes logged to audit trail.
> 4. **Delete:** Soft delete (archived) or hard delete with confirmation; check dependencies first.

> **Related Articles**
>
> - [Admin CMS Overview](/help/admin/cms-overview) -- Admin system architecture and capabilities.
> - A rich, interconnected data model sits behind every content type you manage.
