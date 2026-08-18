# Play as User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a secure impersonation ("Play as User") feature for admins, complete with client header injection, backend context swapping, audit logging integration, admin UI action buttons, and a red-bordered Halo (Dynamic Island) with an exit trigger.

**Architecture:** Client-side tRPC link detects impersonation target from localStorage and passes it in `x-play-as-user` request header. Backend validates admin authority of caller and swaps the active user ID and database profile in context. Halo reads status and applies red border/glow styling and stop button.

**Tech Stack:** React 19, Next.js 16, tRPC 11, Tailwind CSS 4, Jest 30

## Global Constraints
- **Package manager**: `bun` (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Database write commands are blocked**: `db:migrate`, `db:push`, `db:reset` exit with error.
- **Active branch**: `v2`.
- **Do not run global typechecks or global production builds.**

---

### Task 1: Backend tRPC Impersonation Context & Audit Logging

**Files:**
- Modify: `src/server/api/trpc.ts`
- Create: `src/server/api/__tests__/trpc-impersonation.test.ts`

**Interfaces:**
- Consumes: `x-play-as-user` HTTP header
- Produces: Swapped `ctx.auth.userId`, `ctx.user` context, and `ctx.impersonatorId` field.

- [ ] **Step 1: Write the failing tests**
  Create a new test file `src/server/api/__tests__/trpc-impersonation.test.ts`:
  ```typescript
  import { describe, it, expect, jest } from "@jest/globals";
  import { createTRPCContext } from "../trpc";
  import { db } from "~/server/db";

  // Mock dependencies
  jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
  jest.mock("~/server/db", () => ({
    db: {
      user: {
        findUnique: jest.fn(),
      },
    },
  }));
  jest.mock("~/lib/system-owner-constants", () => ({
    isSystemOwner: (id: string) => id === "system_owner_id",
  }));

  describe("TRPC Context Impersonation", () => {
    it("swaps context to target user when requested by an authorized system owner", async () => {
      const mockFindUnique = db.user.findUnique as any;
      mockFindUnique.mockImplementation(async ({ where }: { where: { clerkUserId: string } }) => {
        if (where.clerkUserId === "system_owner_id") {
          return { clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } };
        }
        if (where.clerkUserId === "target_user_id") {
          return { clerkUserId: "target_user_id", role: null };
        }
        return null;
      });

      const headers = new Headers();
      headers.set("x-play-as-user", "target_user_id");

      const ctx = await createTRPCContext({
        headers,
        req: {
          auth: { userId: "system_owner_id" },
        } as any,
      });

      expect(ctx.auth?.userId).toBe("target_user_id");
      expect(ctx.user?.clerkUserId).toBe("target_user_id");
      expect(ctx.impersonatorId).toBe("system_owner_id");
    });

    it("does NOT swap context if the requester is not an admin", async () => {
      const mockFindUnique = db.user.findUnique as any;
      mockFindUnique.mockImplementation(async ({ where }: { where: { clerkUserId: string } }) => {
        if (where.clerkUserId === "regular_user_id") {
          return { clerkUserId: "regular_user_id", role: null };
        }
        return null;
      });

      const headers = new Headers();
      headers.set("x-play-as-user", "target_user_id");

      const ctx = await createTRPCContext({
        headers,
        req: {
          auth: { userId: "regular_user_id" },
        } as any,
      });

      expect(ctx.auth?.userId).toBe("regular_user_id");
      expect(ctx.user?.clerkUserId).toBe("regular_user_id");
      expect(ctx.impersonatorId).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run command: `bun run test -- src/server/api/__tests__/trpc-impersonation.test.ts`
  Expected: fails with type errors or missing context properties.

- [ ] **Step 3: Modify `trpc.ts` to implement impersonation context and audit log swapping**
  Modify `src/server/api/trpc.ts`:
  Add logic in `createTRPCContext` to inspect headers and fetch admin info to authorize impersonation:
  ```typescript
  // Around line 70, insert impersonatorId variable
  let impersonatorId: string | undefined = undefined;

  // Around line 109, replace:
  // if (auth?.userId) {
  // with:
  if (auth?.userId) {
    try {
      const playAsUserHeader = opts.headers.get("x-play-as-user");
      let activeUserId = auth.userId;

      if (playAsUserHeader && playAsUserHeader !== auth.userId) {
        // Look up the admin user requesting the play-as mode
        let impersonator = getCachedUserContext(auth.userId);
        if (!impersonator) {
          impersonator = await db.user.findUnique({
            where: { clerkUserId: auth.userId },
            include: {
              role: true,
            },
          });
          if (impersonator) {
            setCachedUserContext(auth.userId, impersonator);
          }
        }

        if (impersonator) {
          const isSystemOwnerUser = isSystemOwner(auth.userId);
          const roleLevel = impersonator.role?.level ?? 999;
          const roleName = impersonator.role?.name || "NO_ROLE";
          const isAdmin =
            isSystemOwnerUser ||
            ["owner", "admin", "staff"].includes(roleName) ||
            roleLevel <= 20;

          if (isAdmin) {
            activeUserId = playAsUserHeader;
            impersonatorId = auth.userId;
            auth = { ...auth, userId: activeUserId };
            if (VERBOSE) {
              console.log(`[TRPC Context] Admin ${impersonatorId} playing as user ${activeUserId}`);
            }
          } else {
            console.warn(
              `[TRPC Context] Unauthorized impersonation attempt: User ${auth.userId} tried to play as ${playAsUserHeader}`
            );
          }
        }
      }

      // Check short-lived user context cache first
      user = getCachedUserContext(activeUserId);
      // (Modify remainder of user lookup code to check activeUserId instead of auth.userId)
  ```
  Ensure context return includes `impersonatorId`:
  ```typescript
    return {
      db,
      auth,
      user,
      rateLimitIdentifier,
      impersonatorId,
      ...opts,
    };
  ```
  Modify `auditLogMiddleware` around line 487 to capture the impersonator:
  ```typescript
      if (shouldAudit) {
        const auditEntry = {
          timestamp: new Date().toISOString(),
          userId: ctx.auth?.userId || "anonymous",
          action: path,
          method: "tRPC",
          success: !error,
          duration: endTime - startTime,
          errorMessage: error?.message || null,
          countryId: (input as any)?.countryId || ctx.user?.countryId || null,
          userAgent: ctx.headers?.get("user-agent")?.slice(0, 200) || null,
          ip: ctx.headers?.get("x-forwarded-for") || ctx.headers?.get("x-real-ip") || null,
          inputSummary: input ? Object.keys(input as object).join(",") : null,
          securityLevel: path.includes("execute")
            ? "HIGH"
            : path.includes("Intelligence")
              ? "MEDIUM"
              : "LOW",
          impersonatorId: ctx.impersonatorId || null,
        };

        // Log based on security level
        if (auditEntry.securityLevel === "HIGH" || error) {
          console.error("[SECURITY_AUDIT]", auditEntry);

          // Persist high-security events to database (skip in read-only mode)
          if (!isDatabaseReadOnly) {
            try {
              await ctx.db.auditLog.create({
                data: {
                  userId: auditEntry.userId || "anonymous",
                  action: auditEntry.action,
                  details: JSON.stringify({
                    method: auditEntry.method,
                    duration: auditEntry.duration,
                    securityLevel: auditEntry.securityLevel,
                    ip: auditEntry.ip,
                    userAgent: auditEntry.userAgent,
                    inputSummary: auditEntry.inputSummary,
                    impersonatorId: auditEntry.impersonatorId,
                  }),
                  success: auditEntry.success,
                  error: auditEntry.errorMessage,
                  timestamp: new Date(),
                },
              });
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run command: `bun run test -- src/server/api/__tests__/trpc-impersonation.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  Run command: `git add src/server/api/trpc.ts src/server/api/__tests__/trpc-impersonation.test.ts` and commit.

---

### Task 2: Client tRPC Header Injection

**Files:**
- Modify: `src/trpc/react.tsx`

**Interfaces:**
- Consumes: `localStorage("ixstats.play_as_user")`
- Produces: Outgoing HTTP Request Header `x-play-as-user`

- [ ] **Step 1: Modify `react.tsx` httpBatchStreamLink headers hook**
  Modify `src/trpc/react.tsx` around line 84:
  ```typescript
            // Add Clerk authentication token
            if (getToken) {
              const token = await getToken();
              if (token) {
                headers["authorization"] = `Bearer ${token}`;
              }
            }

            // Impersonation header injection
            if (typeof window !== "undefined") {
              const playAsUser = localStorage.getItem("ixstats.play_as_user");
              if (playAsUser) {
                headers["x-play-as-user"] = playAsUser;
              }
            }

            return headers;
  ```

- [ ] **Step 2: Commit changes**
  Run command: `git add src/trpc/react.tsx` and commit.

---

### Task 3: Admin UI Impersonation Triggers

**Files:**
- Modify: `src/app/admin/_components/UserManagement.tsx`

**Interfaces:**
- Produces: `localStorage` mutation and window redirect on click.

- [ ] **Step 1: Add "Play as User" action triggers inside UserManagement tables**
  Inside `src/app/admin/_components/UserManagement.tsx`:
  
  Add play button in **Linked Users** list:
  ```tsx
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem("ixstats.play_as_user", user.clerkUserId);
                              window.location.href = "/dashboard";
                            }}
                            className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                          >
                            Play as User
                          </Button>
                          <div className="flex items-center gap-2">
  ```

  Add play button in **Unlinked Users** list:
  ```tsx
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem("ixstats.play_as_user", user.clerkUserId);
                              window.location.href = "/dashboard";
                            }}
                            className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                          >
                            Play as User
                          </Button>
                          <div className="flex items-center gap-2">
  ```

  Add play button in **User Role Assignments** table:
  ```tsx
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem("ixstats.play_as_user", user.clerkUserId);
                              window.location.href = "/dashboard";
                            }}
                            className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                          >
                            Play as User
                          </Button>
                          {user.role && (
                            <Can I="manage" a="Role">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveUserRole(user.clerkUserId)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove Role
                              </Button>
                            </Can>
                          )}
                        </div>
                      </TableCell>
  ```

- [ ] **Step 2: Commit changes**
  Run command: `git add src/app/admin/_components/UserManagement.tsx` and commit.

---

### Task 4: Halo (Dynamic Island) Red Border Styling

**Files:**
- Modify: `src/components/ui/dynamic-island.tsx`

**Interfaces:**
- Consumes: `localStorage("ixstats.play_as_user")`
- Produces: CSS layout classes and animation gradients.

- [ ] **Step 1: Modify `dynamic-island.tsx` to conditionally apply red borders and shadows**
  In `src/components/ui/dynamic-island.tsx`, add localStorage detection state in `DynamicIslandContent`:
  ```typescript
    // Inside DynamicIslandContent component (around line 496):
    const [isImpersonating, setIsImpersonating] = useState(false);

    useEffect(() => {
      if (typeof window !== "undefined") {
        setIsImpersonating(!!localStorage.getItem("ixstats.play_as_user"));
      }
    }, [children]); // re-evaluate on children renders to capture changes
  ```

  Update the glow container `dynamic-island-glow` (around line 557) to render a red glow when impersonating:
  ```typescript
        <motion.div
          layout
          layoutId="dynamic-island-glow"
          className="force-gpu pointer-events-none absolute inset-0"
          animate={{
            borderRadius: currentSize.borderRadius,
            opacity: isCompactSize(state.size) ? 0.6 : 0.15,
          }}
          transition={{
            type: "spring",
            stiffness,
            damping,
            mass,
          }}
          style={{
            willChange: "transform, opacity",
            transform: "translate3d(0, 0, 0)",
            backfaceVisibility: "hidden",
          }}
        >
          {isImpersonating ? (
            <>
              <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-500/35 via-orange-500/35 to-red-500/35 blur-xl" />
              <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-400/25 via-red-500/25 to-orange-400/25 blur-lg" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 blur-xl" />
              <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-cyan-400/20 via-indigo-500/20 to-purple-400/20 blur-lg" />
            </>
          )}
        </motion.div>
  ```

  Update the main dynamic island background container `dynamic-island-main` (around line 567) to apply red border classes:
  ```typescript
        <motion.div
          id={id}
          layout
          layoutId="dynamic-island-main"
          className={`focus-within:bg-accent/80 force-gpu relative mx-auto items-center justify-center border text-center shadow-2xl shadow-black/40 transition-colors duration-200 ${
            isImpersonating
              ? "border-red-500/80 dark:border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.45)]"
              : "border-white/20 dark:border-white/10"
          }`}
  ```

- [ ] **Step 2: Commit changes**
  Run command: `git add src/components/ui/dynamic-island.tsx` and commit.

---

### Task 5: Stop Impersonating UI inside Halo

**Files:**
- Modify: `src/components/halo/ExpandedView.tsx`

**Interfaces:**
- Produces: Exit button and redirect back to `/admin/user-management`.

- [ ] **Step 1: Add a header warning banner and Stop button in ExpandedView**
  In `src/components/halo/ExpandedView.tsx` around line 28:
  ```tsx
    const [isImpersonating, setIsImpersonating] = useState(false);
    useEffect(() => {
      if (typeof window !== "undefined") {
        setIsImpersonating(!!localStorage.getItem("ixstats.play_as_user"));
      }
    }, [mode]);

    const handleStopImpersonating = () => {
      localStorage.removeItem("ixstats.play_as_user");
      window.location.href = "/admin/user-management";
    };

    return (
      <div
        className="relative max-h-[80vh] w-full overflow-y-auto text-left"
        style={{ scrollbarWidth: "thin" }}
      >
        {isImpersonating && (
          <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              <span>Playing as: <span className="font-mono">{typeof window !== "undefined" && localStorage.getItem("ixstats.play_as_user")}</span></span>
            </div>
            <button
              onClick={handleStopImpersonating}
              className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
  ```

- [ ] **Step 2: Commit changes**
  Run command: `git add src/components/halo/ExpandedView.tsx` and commit.
