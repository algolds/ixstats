---
title: Reference Data Management
description: Create, edit, and organize game content catalogs including government components, economic policies, military equipment, and diplomatic scenarios.
badge: For Admins
---

## Government Components

- **24 Atomic Components:** DEMOCRATIC_PROCESS, FEDERAL_SYSTEM, CONSTITUTIONAL_MONARCHY, etc.
- **Fields:** Name, description, category, effectiveness score (0-100), tier requirements.
- **Synergies:** Define compatible components that boost effectiveness when combined.
- **Conflicts:** Mark incompatible combinations that reduce effectiveness or cause instability.
- Changes immediately reflected in the country builder component selector.

## Economic Components

> **40+ Policy Components**
>
> - Categories: Trade Policy, Labor Market, Investment, Innovation, Infrastructure, Environment.
> - Effects: GDP impact, employment, innovation index, sustainability, inequality.
> - Prerequisites: Tier requirements, prerequisite components, unlock conditions.
> - Formulas: Custom calculation expressions for dynamic economic modeling.

## Tax System Components

- **42 Tax Types:** Income, corporate, VAT, property, capital gains, etc.
- **Rate Configuration:** Min/max rates, progressive brackets, flat rates, exemptions.
- **Revenue Formulas:** Base calculations with GDP multipliers, population factors, compliance rates.
- **Economic Effects:** Growth impact, inequality adjustments, compliance costs.

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

- **8 Personality Traits:** Assertiveness, cooperativeness, risk tolerance, pragmatism, etc.
- **Calculation Formulas:** Define how traits derive from observable data (alliances, conflicts, trade).
- **Archetypes:** Configure 6 personality profiles (Pragmatist, Idealist, Aggressor, etc.).
- **Drift Parameters:** Max annual change rates, influence factors.

## CRUD Operations

> **Standard Admin Workflow**
>
> 1. **Create:** Click "New \[Type\]" button, fill form, validate, save to database.
> 2. **Read:** Browse list view with filters, search, pagination; click to view details.
> 3. **Update:** Edit inline or via form; changes logged to audit trail.
> 4. **Delete:** Soft delete (archived) or hard delete with confirmation; check dependencies first.

## Bulk Operations

- **CSV Import:** Upload spreadsheet with standardized columns; preview before commit.
- **Batch Edit:** Select multiple items, apply common changes (tags, categories, effectiveness scores).
- **Export:** Download current catalog as CSV or JSON for backup or external analysis.
- **Validation:** Automatic checks for duplicates, invalid references, missing required fields.

> **Related Articles**
>
> - [Admin CMS Overview](/help/admin/cms-overview) -- Admin system architecture and capabilities.
> - A rich, interconnected data model sits behind every content type you manage.
