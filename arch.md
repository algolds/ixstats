IxStats Agent Architecture Doc
Purpose: Prevent TypeScript Graph Explosion + Stabilize Dev Performance
🧠 0. Core Principle (NON-NEGOTIABLE)

IxStats must never become a single fully-connected TypeScript graph.

❌ No “god files”
❌ No cross-router imports
❌ No shared mega-types
❌ No index-barrel dependency webs

🧱 1. Project Architecture Rules
1.1 Layering Model

The system is strictly layered:

UI (Next.js app)
   ↓
API Layer (routers only)
   ↓
Domain Modules (business logic)
   ↓
Shared Core (minimal primitives only)
   ↓
Infra (db, auth, external services)
1.2 Import Direction Rules (CRITICAL)

Allowed:

ui → api → modules → shared → infra

NOT allowed:

modules → api ❌
modules → modules ❌
shared → modules ❌
ui → server internals ❌
📦 2. Folder Structure (MANDATORY)
src/
  app/                      # Next.js UI layer
  components/

  server/
    api/
      routers/             # ONLY routing logic
      index.ts

    modules/               # BUSINESS LOGIC (core system)
      geo/
        geo.router.ts
        geo.service.ts
        geo.repo.ts
        geo.types.ts

      diplomatic/
        diplomatic.router.ts
        diplomatic.service.ts
        diplomatic.repo.ts
        diplomatic.types.ts

    shared/                # MINIMAL shared utilities only
      db.ts
      auth.ts
      base-types.ts

    infra/                 # external systems
      prisma/
      redis/
      logger.ts
🚨 3. Router Rules (VERY IMPORTANT)
3.1 Routers must be thin

A router may ONLY:

define endpoints
validate input
call service layer
return response
❌ Forbidden in routers:
business logic
database queries
cross-module logic
complex transformations
✅ Example:
// geo.router.ts
export const geoRouter = router({
  getRegion: async ({ input }) => {
    return geoService.getRegion(input.id);
  }
});
🧠 4. Service Layer Rules

Services contain ALL logic.

Allowed:
computation
DB calls
domain rules
transformations
❌ Not allowed:
importing other domain modules directly

If cross-domain logic is needed → use a coordinator service in shared/ or orchestration/

📦 5. Module Isolation Rule (CRITICAL FOR TS PERFORMANCE)

Each module must be self-contained:

geo/
  geo.service.ts
  geo.repo.ts
  geo.types.ts
Rules:
modules cannot import other modules
modules only expose services
modules never import routers
🧾 6. Types System Rules
❌ Forbidden:
global AppTypes
giant types.ts
shared type dumping files
barrel export type aggregation
✅ Required:

Each module owns its types:

export type GeoRegion = {
  id: string;
  name: string;
};
Shared types ONLY:
shared/base-types.ts

Allowed only:

ID
Timestamp
basic primitives
📉 7. TypeScript Performance Rules

To prevent tsserver memory explosion:

MUST:
keep files < 500 lines
avoid circular imports
avoid deep re-export chains
avoid wildcard exports (export *)
avoid giant index.ts files
MUST NOT:
create “central type registry”
cross-import domain logic
nest modules beyond 2 levels deep
⚙️ 8. Next.js Integration Rules
Server-side only:
modules
infra
shared
Client-side only:
app/
components/
NEVER:
import server modules into client components
🧠 9. Performance Safety Constraints

These constraints exist to prevent:

tsserver > 1GB RAM
WSL vmmem spikes
Cursor extension host overload
Hard limits:
Metric	Limit
TS file size	< 500 lines
module depth	max 2 levels
shared dependencies per module	minimal
cross-module imports	0
🔥 10. Refactor Rules (when editing existing code)

When encountering large legacy files:

MUST DO:
split by domain responsibility
extract service layer first
isolate types second
only then split router
NEVER:
“optimize” inside giant file
add more logic into existing router
merge modules together
🚨 11. Anti-Patterns (DO NOT INTRODUCE)
“utils.ts dumping ground”
“common.ts everything file”
“shared business logic folder”
“index.ts barrel exports everywhere”
cross-domain imports for convenience
monolithic routers
🧠 12. Goal of this Architecture

This system is designed to:

✅ Keep tsserver under control
✅ Prevent dependency graph explosion
✅ Make modules independently testable
✅ Allow safe scaling beyond 100k+ LOC
✅ Ensure WSL dev environment stays stable (<2–3GB RAM)
🧭 13. If unsure rule

If an agent is unsure where code belongs:

Prefer duplication over coupling
Prefer isolation over reuse
Prefer small modules over shared abstractions