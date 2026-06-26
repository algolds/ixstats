# Plan 090: Consolidated Security Hardening (Middleware, CSP, and sync-from-bot)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3f479157..HEAD -- src/proxy.ts src/app/api/ixtime/sync-from-bot/route.ts CLAUDE.md AGENTS.md README.md scripts/audit/audit-components.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `3f479157`, 2026-06-26

## User Review Required

> [!IMPORTANT]
> This plan removes `'unsafe-eval'` from the Content-Security-Policy for **production mode only**, keeping it enabled in **development mode** (where it is required by Next.js's Fast Refresh/dev server). Removing it in production is highly recommended to mitigate dynamic XSS vectors, but may break specific third-party library dependencies if they perform runtime evaluation (e.g., dynamic calculation of formulas). The executor should test the production build locally before deploying.
>
> Additionally, renaming the middleware file from `src/proxy.ts` to `src/middleware.ts` activates Clerk authentication and edge security headers globally. Ensure that Clerk secret keys are configured in local environment files to avoid redirection issues during local testing.

## Why this matters

This consolidated plan hardens the application against several critical security vulnerabilities:
1. **Middleware Bypass**: `src/proxy.ts` is currently ignored by Next.js because it is not named `middleware.ts`. Renaming it restores global edge protections, including Clerk auth redirection, Content Security Policy injection, clickjacking protection (X-Frame-Options), and CVE-2025-29927 header spoofing blockers.
2. **CSP unsafe-eval**: Removes `'unsafe-eval'` from production CSP rules to prevent dynamic code execution exploitation in the browser (XSS mitigation).
3. **Open sync-from-bot Endpoint**: Secures the time sync API which currently falls open (no authentication) if the server's `IXTIME_BOT_SECRET` is unset.

## Current state

- Files in scope:
  - `src/proxy.ts` — The current inactive middleware file
  - `src/app/api/ixtime/sync-from-bot/route.ts` — Handlers for bot time sync
  - `CLAUDE.md`, `AGENTS.md`, `README.md`, `scripts/audit/audit-components.ts` — Reference documentation and tooling referencing `src/proxy.ts`

Excerpt from `src/proxy.ts:50-57`:
```typescript
function buildCSPTemplate(standalone: boolean): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Use nonce-based script-src for both main app and standalone IxWorld
  // strict-dynamic allows scripts with a valid nonce to load additional scripts
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`;
```

Excerpt from `src/app/api/ixtime/sync-from-bot/route.ts:5-14`:
```typescript
export async function POST(request: Request) {
  try {
    // Bot-to-server sync: Verify request is from trusted bot via shared secret
    const authHeader = request.headers.get("authorization");
    const botSecret = process.env.IXTIME_BOT_SECRET;

    // If bot secret is configured, require it for bot-to-server sync
    if (botSecret && authHeader !== `Bearer ${botSecret}`) {
      return NextResponse.json({ error: "Invalid bot authentication" }, { status: 401 });
    }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Lint      | `bun run lint`           | exit 0              |
| Tests     | `bun run test`           | all pass            |

## Scope

**In scope**:
- Rename `src/proxy.ts` to `src/middleware.ts`
- Remove `'unsafe-eval'` from production CSP inside `src/middleware.ts`
- Secure `/api/ixtime/sync-from-bot` inside `src/app/api/ixtime/sync-from-bot/route.ts`
- Update doc/tool references to `src/proxy.ts`

**Out of scope**:
- Modifying CSP configurations for development mode (must retain `'unsafe-eval'`)
- Changing other time/ixtime API endpoints or cron routes

## Git workflow

- Branch: `advisor/090-consolidated-security-hardening`
- Commit message style: `security: consolidated security hardening of middleware, CSP, and bot sync`

## Steps

### Step 1: Rename the middleware file
Rename the middleware file to Next.js's standard `src/middleware.ts`:
`git mv src/proxy.ts src/middleware.ts`

**Verify**:
`ls -la src/middleware.ts` outputs the file, and `src/proxy.ts` is deleted.

### Step 2: Remove unsafe-eval from production CSP
Edit `src/middleware.ts` to remove `'unsafe-eval'` from the production `scriptSrc` template.

Apply this change:
```diff
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
-   : `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`;
+   : `script-src 'self' 'unsafe-inline' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`;
```

**Verify**:
`grep -n "unsafe-eval" src/middleware.ts` only matches the development check branch.

### Step 3: Secure the sync-from-bot endpoint
Modify `src/app/api/ixtime/sync-from-bot/route.ts` to require authentication and fail closed in production if the secret is missing.

Apply this change:
```diff
 export async function POST(request: Request) {
   try {
     // Bot-to-server sync: Verify request is from trusted bot via shared secret
     const authHeader = request.headers.get("authorization");
     const botSecret = process.env.IXTIME_BOT_SECRET;
+    const isProduction = process.env.NODE_ENV === "production";
 
-    // If bot secret is configured, require it for bot-to-server sync
-    if (botSecret && authHeader !== `Bearer ${botSecret}`) {
-      return NextResponse.json({ error: "Invalid bot authentication" }, { status: 401 });
-    }
+    // In production, IXTIME_BOT_SECRET is mandatory
+    if (isProduction && !botSecret) {
+      console.error("[SECURITY] IXTIME_BOT_SECRET not configured in production - bot sync disabled");
+      return NextResponse.json({ error: "Sync endpoint not configured" }, { status: 503 });
+    }
+
+    // Require valid Bearer token if secret is configured, or if in production
+    if (botSecret || isProduction) {
+      if (!authHeader || authHeader !== `Bearer ${botSecret}`) {
+        console.warn(
+          `[SECURITY] Unauthorized bot sync access attempt from ${request.headers.get("x-forwarded-for") || "unknown"}`
+        );
+        return NextResponse.json({ error: "Invalid bot authentication" }, { status: 401 });
+      }
+    }
```

**Verify**:
Ensure the diff is correctly applied with no typecheck issues.

### Step 4: Update proxy.ts references in docs and tools
Update references to `src/proxy.ts` to `src/middleware.ts` in the following files:
1. `CLAUDE.md` (lines 8, 63, 97)
2. `AGENTS.md` (line 70)
3. `README.md` (line 234)
4. `scripts/audit/audit-components.ts` (lines 16, 149)
5. `docs/RATE_LIMITING_GUIDE.md` (lines 76, 1163)

**Verify**:
`grep -rn "src/proxy.ts" .` returns no code or active doc references (ignoring historical CHANGELOG entries).

### Step 5: Validate code structure
Run workspace checks to make sure the app typechecks and tests compile.

**Verify**:
`bun run lint` and `bun run test` exit with 0.

## Test plan

### Manual Verification
1. **Verify Middleware/CSP**:
   - Start the app: `bun run dev` (or `./start-development.sh`).
   - Request the home page: `curl -I http://localhost:3000/`
   - Check headers for `Content-Security-Policy`, `X-Frame-Options`, `X-CSP-Nonce`.
2. **Verify Auth Redirects**:
   - Request a protected page without auth: `curl -I http://localhost:3000/admin`
   - Should return a `307` or `302` redirect to `/sign-in`.
3. **Verify CSP in Production**:
   - Run production build: `NODE_ENV=production bun run build && bun run start:prod`
   - Verify `Content-Security-Policy` header in response does NOT contain `'unsafe-eval'`.
4. **Verify sync-from-bot Endpoint**:
   - With `IXTIME_BOT_SECRET` unset in dev: POST `{"ixTimeMs": 1000}` to `/api/ixtime/sync-from-bot` -> should succeed (200).
   - With `IXTIME_BOT_SECRET=testsecret` in dev: POST without auth -> should return 401. POST with correct Bearer header -> should succeed (200).
   - In simulated production (`NODE_ENV=production`) with secret unset: POST -> should fail with 503 ("Sync endpoint not configured").

## Done criteria

- [ ] `src/middleware.ts` exists and contains the removed `unsafe-eval` production CSP rules.
- [ ] `/api/ixtime/sync-from-bot` has fail-closed authentication.
- [ ] No active references to `src/proxy.ts` remain.
- [ ] `bun run lint` and `bun run test` pass.
- [ ] `plans/README.md` status updated.

## STOP conditions

- Stop and report back if the build fails with a Clerk keys error during `next build` or `bun run dev` after renaming.
- Stop and report back if the browser console logs CSP violations related to `'unsafe-eval'` while executing essential user flows in production mode.
