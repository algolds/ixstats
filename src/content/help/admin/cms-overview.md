---
title: Admin Content Management System
description: Manage 100% dynamic content through 20+ admin interfaces for government components, economic policies, military equipment, diplomatic scenarios, and system configuration.
badge: For Admins
---

## CMS Capabilities

- **100% Dynamic Content:** All game content lives in database; no code deployments needed for updates.
- **20+ Admin Interfaces:** 10+ reference data, 2 intelligence/templates, 4 analytics, 2 system admin, and specialized tools.
- **Role-Based Access:** ADMIN, CONTENT_EDITOR, MILITARY_ADMIN roles with granular permissions.
- **Audit Logging:** All changes tracked with user, timestamp, before/after values.

## Reference Data Management (9 Interfaces)

> **Content Catalogs**
>
> - **Government Components:** 24 atomic components with effectiveness scores, synergies, conflicts.
> - **Economic Components:** 40+ policy components with tier requirements and effects.
> - **Tax System Components:** 42 tax types with rate ranges and revenue formulas.
> - **Diplomatic Scenarios:** 100+ scenario templates with NPC personality modifiers.
> - **Military Equipment:** 500+ items (tanks, aircraft, ships, small arms) with specifications.
> - **NPC Personalities:** 8 personality traits with calculation formulas and archetypes.
> - **Crisis Events:** Event templates with severity levels, impact calculations, response options.
> - **Economic Archetypes:** Country economy templates with tier assignments.
> - **Achievement Definitions:** Unlock criteria, rewards, progression tiers.

## Intelligence & Templates (2 Interfaces)

- **Briefing Templates:** Customizable intelligence report formats with dynamic data sources.
- **Alert Rules:** Configure thresholds, priorities, notification channels for intelligence alerts.

## Analytics & Monitoring (4 Interfaces)

- **Platform Performance:** response times, error rates, and where traffic is going across the platform.
- **User Activity:** sign-ins, feature usage, and session trends.
- **System Health:** how the platform's core services are holding up at a glance.

## System Administration (2 Interfaces)

> **Platform Management**
>
> - **Global Settings:** IxTime configuration, feature flags, maintenance mode, system announcements.
> - **Role Management:** Assign/revoke ADMIN, CONTENT_EDITOR, MAP_EDITOR, MILITARY_ADMIN roles.

## Bulk Operations

- **CSV Import:** Bulk upload equipment, components, scenarios from spreadsheets.
- **Batch Updates:** Mass edit attributes across multiple items simultaneously.
- **Export:** Download reference data as CSV/JSON for external analysis or backup.
- **Validation:** Pre-import checks for schema compliance, duplicate detection, referential integrity.

> [!WARNING]
> **Access & Security**
>
> - Admin areas are limited to the right roles, and any unauthorized attempt is logged.
> - Every change is recorded in the audit log, with a complete history.
> - Monitor admin activity via the admin analytics dashboard.
> - Enable 2FA for admin accounts in production environments (recommended).

> **Related Articles**
>
> - [Reference Data Management](/help/admin/reference-data) -- Managing game content catalogs.
> - [Help Center](/help) -- guides for every part of the platform.
