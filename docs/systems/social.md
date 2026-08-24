# 💬 ThinkPages — Sovereign Feed, ThinkTanks & ThinkShare

**Parent App Suite:** ThinkPages (`THINKPAGES_VERSION = 2`)  
**Subsystems:** Sovereign Feed, Account Manager, Collaborative ThinkTanks, ThinkShare Messaging  
**Primary Action:** `DELIBERATE` | **Domain Accent:** Emerald Jade (`#10B981` / `--color-emerald-500`)  
**Routes:** `/thinkpages`, `/thinktanks`, `/messages` | **Status:** 📀 Gold Master (100% Ready)  

ThinkPages is the real-time communications and publishing network of IxStates. It pairs public sovereign micro-publishing with multilateral ThinkTank working rooms, automated Discord webhook distribution, and encrypted ThinkShare direct messaging.

---

## 1. Sovereign Feed & Micro-Publishing (`/thinkpages`)

The **Sovereign Feed** is the public town square for national announcements, diplomatic communiqués, breaking news, and community polling:
- **`[blurb:slug|Title]` Embedding**: Authors prefix dispatches with wiki blurb tags to embed live, interactive MediaWiki lore cards and country dossiers directly in the feed.
- **Official Seals & Sovereign Identity**: Posts display sovereign state seals, leader titles, and verified nation tags to establish authority and status.
- **National Polls**: Real-time polling widgets let rulers gauge international sentiment and domestic approval with instant visual tallying.
- **Hashtag Indexing**: Indexed topic channels (`#treaty`, `#economy`, `#crisis`, `#lore`) aggregate discussions across sovereign borders.

---

## 2. Account Manager & Discord Bridge

- **Multi-Account Switching**: Rulers manage multiple sovereign states or persona profiles and switch identities with a single click without logging out.
- **Automated Discord Webhook Syndication**: Publishing an official dispatch automatically mirrors the message to linked community Discord channels via background webhooks.
- **Bot Telemetry**: Real-time status indicators sync live server events and election calls directly between Discord and the ThinkPages feed.

---

## 3. ThinkTanks Collaborative Workspaces (`/thinktanks`)

ThinkTanks are dedicated research and policy drafting rooms for alliances, international coalitions, and co-authors:
- **Joint Working Papers**: Real-time collaborative drafting for multilateral treaties, trade accords, and shared world history.
- **Role-Based Membership**: Group ownership, contributor permissions, and member roster management.
- **Direct Directive Handoff**: Drafted policy proposals can be directly exported into MyCountry as formal Directives.

---

## 4. ThinkShare Real-Time Messaging (`/messages`)

All platform direct messaging runs on the unified ThinkShare infrastructure:
- **Message Types**: Personal 1:1 DMs, Diplomatic cables, Group rooms, and pinned **System / LoreBot** streams.
- **Classification Tiers**: `PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`, `TOP_SECRET`.
- **Security**: Digital signatures, end-to-end encryption (`encryptedContent`), and audit trails.
- **High-Performance Caching**: Feed lookups resolve in **~1.4ms** via `globalCache` with instant targeted cache invalidation on new posts.

---

## Related Documentation

- [ThinkTanks Collaborative Groups Guide](./thinktanks.md)
- [Diplomacy System Guide](./diplomacy.md)
- [Forum Integration](./forum.md)
- [API Reference: ThinkPages & Messages](../reference/api-complete.md#thinkpages-router)
