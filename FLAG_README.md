# 🇺🇳 Flag System - Developer & Admin Guide

## Overview
The ixstats flag system provides efficient, reliable country flag display and caching for all countries in the platform. It fetches flag images from MediaWiki templates, caches them, and exposes them to the frontend via a React component, hooks, and API endpoints.

---

## Architecture
- **Flag Service** (`src/lib/flag-service.ts`): Main interface for getting flag URLs, checking placeholders, and stats.
- **Flag Cache Manager** (`src/lib/flag-cache-manager.ts`): Handles batch fetching, caching, and updating of flag images.
- **MediaWiki Service** (`src/lib/mediawiki-service.ts`): Integrates with MediaWiki to fetch flag data and resolve file URLs.
- **React Components**:
  - `CountryFlag.tsx`: Displays a flag for a given country, with placeholder fallback.
  - `FlagCacheManager.tsx`: Admin UI for monitoring and updating the flag cache.
- **API Endpoints**:
  - `/api/flag-cache`: For cache management (init, update, status, clear).
  - `/api/flags/test`: For testing flag resolution for a specific country.
- **Scripts**:
  - `scripts/update-flag-cache.js`: Runs batch updates (for cron jobs).
  - `scripts/setup-flag-cache-cron.sh`: Sets up automatic monthly updates.

---

## Usage
### In React
```tsx
import { CountryFlag } from '~/app/_components/CountryFlag';
<CountryFlag countryName="United_States" size="md" showPlaceholder />
```

### In Admin Panel
```tsx
import { FlagCacheManager } from '~/components/FlagCacheManager';
<FlagCacheManager />
```

### Programmatic (Server/Script)
```ts
import { flagService } from '~/lib/flag-service';
const url = await flagService.getFlagUrl('Germany');
```

### API
- `GET /api/flag-cache?action=status` — Get cache status
- `POST /api/flag-cache?action=update` — Update all flags
- `POST /api/flag-cache?action=initialize` — Initialize cache
- `DELETE /api/flag-cache?action=clear` — Clear cache
- `GET /api/flags/test?country=Japan` — Test flag for a country

---

## Caching & Updates
- Flags are cached for 30 days by default.
- Automatic monthly updates are set up via cron (`setup-flag-cache-cron.sh`).
- Manual update/init can be triggered via API or admin UI.
- Failed fetches are retried with exponential backoff.

---

## Placeholders & Fallbacks
- If a flag cannot be found, a placeholder SVG is used.
- Placeholders are detected by URL (`/api/placeholder-flag.svg` or containing `placeholder`).
- The `CountryFlag` component shows country initials if no flag is available.

---

## Troubleshooting
- Use `/test-flags` page or `/api/flags/test?country=...` to debug flag issues.
- Check logs in the admin panel or cron job output for errors.
- If flags are missing, try clearing and re-initializing the cache.
- Ensure MediaWiki API is reachable and up-to-date.

---

## Extending/Modifying
- To add new countries, update the country database and re-initialize the cache.
- To change cache duration or batch size, edit `FlagCacheConfig` in `flag-cache-manager.ts`.
- For new flag sources, extend `mediawiki-service.ts`.

---

## Contact
For issues or questions, contact the ixstats maintainers or open an issue in the project repository. 