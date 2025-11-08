# In-App Help Center

**Last updated:** November 2025

The help center at `/help` delivers React-rendered articles that mirror the Markdown guides under `docs/`. Each article uses shared layouts for consistent typography, navigation, and metadata.

**v1.4.0 Coverage:** 47 articles across 10 categories covering all platform features including crisis events, NPC AI, vector tile maps, admin CMS (17 interfaces), and rate limiting.

## Structure
```
/src/app/help/
├── page.tsx                # Hub with search + category filters (6 categories)
├── _components/
│   └── ArticleLayout.tsx   # Shared layout for articles
├── getting-started/        # Onboarding content (4 articles)
├── economy/                # Economic system guides (4 articles)
├── government/             # Governance & atomic guides (4 articles)
├── defense/                # Defense, crisis ops, equipment (6 articles)
├── diplomacy/              # Foreign affairs, NPC AI, scenarios (5 articles)
├── intelligence/           # Intelligence dashboards & alerts (7 articles)
├── social/                 # ThinkPages / ThinkShare guidance (3 articles)
├── maps/                   # Vector tiles & map editor (2 articles) [NEW v1.4]
├── admin/                  # Admin CMS & reference data (2 articles) [NEW v1.4]
└── technical/              # API, architecture, rate limiting (5 articles)
```

**Total:** 47 articles across 10 categories (up from 38 articles in October 2025).

Each leaf folder contains a `page.tsx` article that wraps content in `ArticleLayout`.

## Hub Configuration
- Section metadata defined in the `helpSections` array inside `page.tsx`
- Update titles, descriptions, and tags when adding or removing articles
- Keep article paths aligned with folder names (e.g., `/help/economy/modeling` → `economy/modeling/page.tsx`)
- Category filter includes: getting-started, features, systems, technical, admin (6 total including "all")

## Authoring Workflow
1. Update the corresponding Markdown guide in `docs/`
2. Replicate or adapt the content inside the matching help article component
3. Ensure metadata (title, description, tags) remains in sync between the hub and the article
4. Add links back to systems documentation where deeper dives are available

## Maintenance
- Run through `/help` after each deploy to confirm navigation and content render correctly
- Add Playwright/Jest coverage for critical help flows when modifying navigation patterns
- Archive unused articles by moving the React file to `src/app/help/_archive` (create if needed) and removing the entry from `helpSections`

Align this README with `docs/systems/help.md` whenever the help center structure changes.
