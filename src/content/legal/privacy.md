---
title: Privacy Policy
description: Your privacy is paramount. This Privacy Policy details how IxStates collects, processes, stores, and protects your information, and how your rights are safeguarded under global privacy standards.
badge: Privacy & Data Protection
lastUpdated: August 16, 2026
version: 1.4.0 "Lobster Crosby"
contact: admin@ixwiki.com
---

This Privacy Policy explains how the **Ixnay Community and IxWiki Administration** (“**IxStates**”, “**we**”, “**us**”, or “**our**”) handles personal information when you access or use our web applications, simulation systems, and creative tools at `ixwiki.com`.

We are committed to operating a transparent, hobbyist-centered conworlding platform that treats user data with respect. We collect only what is strictly necessary to run the simulation, protect system security, and render collaborative features. For terms governing game rules and licensing, please see our [Terms of Service](/terms).

## 1. Information We Collect {#data-collected}

> **Plain English Summary:** We only collect what is needed to create your account (via Clerk), link optional services (Discord/Wiki), store your in-game nations/cards/posts, and defend the server against spam and DDoS attacks.

### 1.1 Account & Authentication Identifiers

When you register an account, authentication is processed via Clerk. We receive and store:

- Your unique Clerk User ID (`clerkUserId`).
- Your verified email address and primary display username.
- Account creation and last update timestamps.

### 1.2 External Account Linking (IxnayID)

If you voluntarily link external platforms to your IxStates identity, we store:

- **Discord:** Your Discord User ID and username (for role synchronization and bot notifications).
- **MediaWiki (IxWiki):** Your wiki user ID and username (for article editing attribution).
- **Old forum (XenForo):** Your old forum member ID and name, kept to attribute your imported forum posts.
- **NationStates:** Your verified nation name (for card deck imports and ownership checks).

### 1.3 In-Game Simulation & User-Generated Content

We store the creative content and simulation state you produce, including national economic statistics, tax policies, cabinet configurations, ThinkPages posts and comments, persona profiles, direct messages (ThinkShare), card trade offers, and Onoma conlang lexicons.

### 1.4 Technical & Security Logs

When your browser makes requests to our servers, we temporarily record IP addresses and user-agent strings in secure server access logs, Redis rate-limiting caches, and PostgreSQL security audit tables. These logs are retained solely for DDoS mitigation, brute-force defense, and rate-limit enforcement.

## 2. How We Use Data & Zero-Sale Commitment {#how-we-use-data}

> **Our Guarantee:** We **never** sell, rent, or trade your personal information. We do not run third-party advertising trackers. Your data is used solely to run the game and protect the community.

We process your data strictly for the following operational purposes:

- **Service Delivery:** Managing authentication sessions, calculating economic simulation cycles, rendering maps, and processing trades.
- **Communication:** Delivering transactional in-game alerts, diplomatic notifications, and account security notices.
- **Security & Abuse Prevention:** Enforcing rate limits, preventing denial-of-service attempts, preventing multi-accounting exploits, and investigating violations of our Terms of Service.

## 3. Subprocessors & Data Infrastructure {#subprocessors-storage}

We work with trusted third-party infrastructure providers to host and secure the platform:

> **Clerk Inc. (United States)**
>
> Provides secure authentication, session management, multi-factor authentication, and encrypted credential storage.

> **Self-Hosted Infrastructure**
>
> Primary PostgreSQL/PostGIS and Redis database instances run within secured Docker containers on private dedicated servers with strict firewall access.

## 4. Cookies & Local Browser Storage {#cookies-local-storage}

IxStates uses strictly functional and necessary cookies and local storage tokens. We do not use third-party cross-site tracking cookies, behavioral ad pixels, or analytics trackers.

- **Clerk Session Tokens:** Secure JWT cookies required to authenticate your session.
- **Active Session Preferences:** Browser local storage keys saving your active country selection, theme choice (dark/light mode), and navigation drawer state.

## 5. User Rights, Erasure & Simulation Continuity {#user-rights-erasure}

> **Plain English Summary:** You can request full deletion of your personal data at any time. We will permanently delete your email, login, and linked accounts. To avoid breaking the persistent simulation for other players, public national records and conlang dictionaries are unlinked and archived as historical world artifacts.

### 5.1 Data Rights (GDPR & CCPA Compliance)

Regardless of your geographic location, you have the following privacy rights:

- **Right of Access:** You may request a copy of all personal data we hold associated with your account.
- **Right to Rectification:** You may correct inaccurate profile data directly in account settings.
- **Right to Data Portability:** You may export your custom Onoma conlang lexicons and nation summaries.
- **Right to Erasure (“Right to be Forgotten”):** You may request permanent deletion of your account and personal data.

### 5.2 Account Deletion & Simulation Continuity Architecture

When an account erasure request is processed:

1. **Permanent PII Purge:** Your Clerk User ID, email address, password records, linked Discord/Wiki/Forum associations, and IP access logs are permanently expunged.
2. **Simulation Anonymization & Archiving:** In-game entities (including public nation profiles, historical trade records, map polygon placements, and public wiki contributions) are severed from your identity and converted into an archived, non-player historic state. This ensures that shared historical timelines and regional economic networks do not experience catastrophic corruption.

## 6. Security Safeguards & Privacy Contact {#security-contact}

### 6.1 Security Standards

All network communication is strictly encrypted in transit using Transport Layer Security (TLS 1.3). Database backups are encrypted at rest, and access to production servers is restricted to authorized system administrators via SSH key authentication.

### 6.2 Children’s Privacy (Age 16+ Requirement)

IxStates is strictly intended for individuals aged **16 and older**. We do not knowingly solicit or collect personal information from individuals under 16. If you believe a minor under 16 has provided us with personal data, please contact us immediately for prompt deletion.

> To request data export, submit an erasure request, or ask privacy questions, please email our data protection team at [privacy@ixwiki.com](mailto:privacy@ixwiki.com).
