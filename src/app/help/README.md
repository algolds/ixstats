# In-App Help Center

**Last updated:** October 2025

The help center at `/help` delivers React-rendered articles that mirror the Markdown guides under `docs/`. Each article uses shared layouts for consistent typography, navigation, and metadata.

## Structure
```
/src/app/help/
├── page.tsx                # Hub with search + category filters
├── _components/
│   └── ArticleLayout.tsx   # Shared layout for articles
├── getting-started/        # Onboarding content
├── economy/                # Economic system guides
├── government/             # Governance & atomic guides
├── defense/                # Defense & crisis ops
├── diplomacy/              # Foreign affairs articles
├── intelligence/           # Intelligence dashboards & alerts
├── social/                 # ThinkPages / ThinkShare guidance
├── unified-intelligence/   # ECI/SDI merged workflows
└── technical/              # API, architecture, troubleshooting
```

Each leaf folder contains a `page.tsx` article that wraps content in `ArticleLayout`.

## Hub Configuration
- Section metadata defined in the `helpSections` array inside `page.tsx`
- Update titles, descriptions, and tags when adding or removing articles
- Keep article paths aligned with folder names (e.g., `/help/economy/modeling` → `economy/modeling/page.tsx`)

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
