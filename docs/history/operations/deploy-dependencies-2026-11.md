# Deploy runbook: dependency sweep (2026-11)

Next.js 16.4.3 → 16.4.6 (seven security advisories fixed in 16.4.5), every in-range update, and the majors that
need no database change: Node 22, jsdom 31, Clerk 7, Plate 53 with Slate 0.146, ioredis 6, motion 14, dotenv 18,
glob 14 and the rest. **No database change and no data script.** Prisma 7 is not part of this deploy; it has its own
branch and plan ([Prisma 7 plan](prisma-7-migration-2026-11.md)).

| Step | When | What |
| --- | --- | --- |
| 1 | Before the deploy | Node 22 on the server |
| 2 | Before the deploy | Clean `node_modules` |
| 3 | The deploy | `./scripts/deploy-production.sh` |
| 4 | After the reload | Checks |
| – | If needed | Rollback |

## 1. Node 22 on the server

jsdom 31 (server-side sanitizing) needs Node `^22.22.2`, and `package.json` `engines` now says `>=22.22.2`. Node 20
reached end of life in April 2026. The repo pins `22.23.5` in `.nvmrc`; CI reads the same file.

```bash
node -v                                   # must print v22.22.2 or later
nvm install 22.23.5 && nvm alias default 22.23.5   # if it does not
pm2 update                                # restart the PM2 daemon so its processes get the new node on PATH
```

The web process runs `bun run next start`, which uses the `node` on the PM2 daemon's PATH, so `pm2 update` matters.
The cron, websocket and IxTwitter processes run under bun and are unaffected.

## 2. Clean `node_modules`

An incremental install left a stale nested copy of `@radix-ui/react-dismissable-layer` under `react-menu`, so a
dropdown menu inside a sheet kept its own layer stack: Escape closed the sheet and left the menu open. A clean install
fixes it, so remove `node_modules` before the deploy script runs `bun install --frozen-lockfile`:

```bash
rm -rf node_modules
```

The local Next patch (`patches/next@16.4.6.patch`, the negative-timestamp dev error) is re-keyed to 16.4.6 and applies
on install.

## 3. The deploy

Promote and run `./scripts/deploy-production.sh` as usual
([release guide A4](../../operations/release-guide.md#a4-build-and-deploy)). Nothing new in the environment:

- **Clerk 7** needs `CLERK_ENCRYPTION_KEY` only when `secretKey` is passed to `clerkMiddleware()` at runtime, and
  `src/proxy.ts` does not.
- **ioredis 6** defaults to RESP3; every client in `src/` sets `protocol: 2`, so the Redis traffic is what it was.

## 4. Checks

- **Sign in and out**, the user menu and the account panel in Settings (Clerk 7, theme variables renamed to
  `colorForeground`, `colorMutedForeground`, `colorInput`, `colorInputForeground`).
- **A card sheet**: open More actions on a copy and press Escape. The menu closes and the sheet stays.
- **The wiki narrator player**: the section scrubber and the volume control are now the Facet `Slider`
  (`@audio-ui/react` is gone).
- **The wiki visual editor**: list toggles and the slash menu's headings (Slate 0.146 `setNodes` typing).
- **A wiki page with templates**: renders and sanitizes as before (jsdom 31, parse5 8). One expected difference:
  the serializer now escapes `<` and `>` inside attribute values (`title="&lt;s&gt;"`), as the HTML spec and current
  browsers do.

## Rollback

Deploy the previous release. Node 20 stays installed beside 22 under nvm; `nvm alias default 20 && pm2 update` puts
it back, and the previous release's `bun.lock` restores its packages.
