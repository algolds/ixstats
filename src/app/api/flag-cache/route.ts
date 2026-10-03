import { NextRequest, NextResponse } from "next/server";
import { serverFlagResolver } from "~/lib/flags/server";
import { api } from "~/trpc/server";
import { requireAdminSession } from "~/server/shared/route-auth";
import { ALL_REALMS } from "~/lib/realms/realm-ids";

const allCountryNames = async (): Promise<string[]> => {
  const { countries } = await api.countries.getAll({ limit: 1000, realm: ALL_REALMS });
  return countries.map((c: any) => c.name);
};

const invalidAction = (usage: string) =>
  NextResponse.json({ success: false, error: `Invalid action. Use ${usage}` }, { status: 400 });

const failureResponse = (method: string, error: unknown) => {
  console.error(`[FlagCache API] ${method} error:`, error);
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Unknown error" },
    { status: 500 }
  );
};

/** Resolver counters in the shapes the admin panel reads. */
function resolverSnapshot() {
  const stats = serverFlagResolver.stats();
  const lookups = stats.hits + stats.misses;
  return {
    totalCountries: stats.memoryCacheSize,
    cachedFlags: stats.hits,
    failedFlags: stats.placeholders,
    isUpdating: stats.inFlightRequests > 0,
    hitRate: lookups > 0 ? stats.hits / lookups : 0,
  };
}

const NO_PROGRESS = { current: 0, total: 0, percentage: 0 };

function statsResponse() {
  const { hitRate, ...counters } = resolverSnapshot();
  return NextResponse.json({
    success: true,
    stats: { ...counters, localFiles: 0, hitRate, lastUpdateTime: Date.now() },
    timestamp: Date.now(),
  });
}

function statusResponse() {
  const { hitRate, ...counters } = resolverSnapshot();
  return NextResponse.json({
    success: true,
    flagCache: {
      ...counters,
      lastUpdateTime: Date.now(),
      nextUpdateTime: null,
      updateProgress: NO_PROGRESS,
    },
    serverFlagCache: {
      ...counters,
      lastUpdateTime: Date.now(),
      updateProgress: NO_PROGRESS,
      diskUsage: { totalFiles: 0, totalSizeBytes: 0, totalSizeMB: 0 },
    },
    mediaWiki: { cacheSize: counters.cachedFlags, hitRate, lastCleared: null },
    timestamp: Date.now(),
  });
}

async function flagsResponse(countryParam: string | null) {
  const requested = (countryParam ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const countryNames = requested.length > 0 ? requested : await allCountryNames();

  const resolved = await serverFlagResolver.resolveBatch(countryNames);
  const flags: Record<string, string | null> = {};
  for (const [name, res] of resolved) flags[name] = res.isPlaceholder ? null : res.flagUrl;

  return NextResponse.json({
    success: true,
    flags,
    totalCountries: countryNames.length,
    timestamp: Date.now(),
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    switch (searchParams.get("action")) {
      case "stats":
        return statsResponse();
      case "status":
        return statusResponse();
      case "flags":
        return await flagsResponse(searchParams.get("countries"));
      default:
        return invalidAction("?action=stats, ?action=status, or ?action=flags");
    }
  } catch (error) {
    return failureResponse("GET", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdminSession();
    if (denied instanceof NextResponse) return denied;

    switch (new URL(request.url).searchParams.get("action")) {
      case "update": {
        const body = await request.json();
        const requested: string[] = body.countries || [];
        serverFlagResolver.prefetch(requested.length > 0 ? requested : await allCountryNames());

        return NextResponse.json({
          success: true,
          message: "Flag cache prefetch started (background download)",
          timestamp: Date.now(),
        });
      }

      case "initialize": {
        const countryNames = await allCountryNames();
        serverFlagResolver.prefetch(countryNames);

        return NextResponse.json({
          success: true,
          message: "Unified flag service initialized",
          countryCount: countryNames.length,
          timestamp: Date.now(),
        });
      }

      default:
        return invalidAction("?action=update or ?action=initialize");
    }
  } catch (error) {
    return failureResponse("POST", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdminSession();
    if (denied instanceof NextResponse) return denied;

    if (new URL(request.url).searchParams.get("action") !== "clear") {
      return invalidAction("?action=clear");
    }
    await serverFlagResolver.clear();

    return NextResponse.json({
      success: true,
      message: "All flag caches cleared (including local files)",
      timestamp: Date.now(),
    });
  } catch (error) {
    return failureResponse("DELETE", error);
  }
}
