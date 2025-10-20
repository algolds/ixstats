# Social & Collaboration System

**Last updated:** October 2025

IxStats provides collaborative storytelling tools through ThinkPages, ThinkShare, activity feeds, and research hubs.

## User Experience
- `src/app/thinkpages` – Main ThinkPages exploration and content creation flows
- `src/components/thinkpages` – Feed cards, editors, research timelines
- `src/components/thinkshare` – Sharing widgets, reactions, threaded conversations
- `LiveEventsFeed.tsx` – Real-time event ticker for think tanks and social updates

## Backend Routers
- `thinkpages.ts` – CRUD for pages, posts, comments, reactions, subscriptions
- `activities.ts` – Aggregated global/user feeds, engagement metrics, comment APIs
- `notifications.ts` – Social notifications and unread management

## Data Models
- `ThinkPage`, `ThinkPost`, `ThinkComment`, `ThinkReaction`, `Activity`, `ActivityEngagement`
- Social metrics feed into achievements and leaderboards

## Integration Points
- Collaboration hooks into achievements (e.g., milestone unlocks) and notifications for mentions or comments
- ThinkPages surfaces appear inside MyCountry analytics for context-rich insights

## Authoring & Moderation
- Inline moderation controls via policy/quick action components
- Activity feed endpoints support pagination, filters, and rate-limited posting

## Documentation Requirements
- Update `/help/social/*` whenever the content editor, sharing mechanics, or feed logic change
- Ensure new social features include tests or audits in `tests/` or `scripts/audit`

This guide should evolve as new collaboration mechanics, moderation tools, or integrations go live.
