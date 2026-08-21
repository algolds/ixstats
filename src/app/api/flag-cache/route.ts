// src/app/api/flag-cache/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { serverFlagResolver } from "~/lib/flags/server";
import { api } from "~/trpc/server";
import { isSystemOwner } from "~/lib/auth";

// Helper to check admin access
async function requireAdminAccess(): Promise<{ authorized: boolean; error?: NextResponse }> {
  const session = await auth();
  if (!session?.userId) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (!isSystemOwner(session.userId)) {
    const role = (session.sessionClaims?.metadata as any)?.role;
    if (!["admin", "owner", "staff"].includes(role)) {
      return {
        authorized: false,
        error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      };
    }
  }

  return { authorized: true };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "stats": {
        const stats = serverFlagResolver.stats();
        return NextResponse.json({
          success: true,
          stats: {
            totalCountries: stats.memoryCacheSize,
            cachedFlags: stats.hits,
            failedFlags: stats.placeholders,
            localFiles: 0,
            hitRate: stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
            lastUpdateTime: Date.now(),
            isUpdating: stats.inFlightRequests > 0,
          },
          timestamp: Date.now(),
        });
      }

      case "status": {
        const stats = serverFlagResolver.stats();
        return NextResponse.json({
          success: true,
          flagCache: {
            totalCountries: stats.memoryCacheSize,
            cachedFlags: stats.hits,
            failedFlags: stats.placeholders,
            lastUpdateTime: Date.now(),
            nextUpdateTime: null,
            isUpdating: stats.inFlightRequests > 0,
            updateProgress: {
              current: 0,
              total: 0,
              percentage: 0,
            },
          },
          serverFlagCache: {
            totalCountries: stats.memoryCacheSize,
            cachedFlags: stats.hits,
            failedFlags: stats.placeholders,
            lastUpdateTime: Date.now(),
            isUpdating: stats.inFlightRequests > 0,
            updateProgress: {
              current: 0,
              total: 0,
              percentage: 0,
            },
            diskUsage: {
              totalFiles: 0,
              totalSizeBytes: 0,
              totalSizeMB: 0,
            },
          },
          mediaWiki: {
            cacheSize: stats.hits,
            hitRate: stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
            lastCleared: null,
          },
          timestamp: Date.now(),
        });
      }

      case "flags": {
        const countryParam = searchParams.get("countries");
        let countryNames: string[] = [];

        if (countryParam) {
          countryNames = countryParam
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);
        }

        if (countryNames.length === 0) {
          const allCountries = await api.countries.getAll({ limit: 1000 });
          const names = allCountries.countries.map((c: any) => c.name);
          countryNames.push(...names);
        }

        const map = await serverFlagResolver.resolveBatch(countryNames);
        const flagUrls: Record<string, string | null> = {};
        for (const [name, res] of map.entries()) {
          flagUrls[name] = res.isPlaceholder ? null : res.flagUrl;
        }

        return NextResponse.json({
          success: true,
          flags: flagUrls,
          totalCountries: countryNames.length,
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use ?action=stats, ?action=status, or ?action=flags",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[FlagCache API] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireAdminAccess();
    if (!authCheck.authorized) {
      return authCheck.error;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "update": {
        const body = await request.json();
        const updateCountryNames = body.countries || [];

        if (updateCountryNames.length === 0) {
          const allCountries = await api.countries.getAll({ limit: 1000 });
          const names = allCountries.countries.map((c: any) => c.name);
          serverFlagResolver.prefetch(names);
        } else {
          serverFlagResolver.prefetch(updateCountryNames);
        }

        return NextResponse.json({
          success: true,
          message: "Flag cache prefetch started (background download)",
          timestamp: Date.now(),
        });
      }

      case "initialize": {
        const initAllCountries = await api.countries.getAll({ limit: 1000 });
        const initCountryNames = initAllCountries.countries.map((c: any) => c.name);

        serverFlagResolver.prefetch(initCountryNames);

        return NextResponse.json({
          success: true,
          message: "Unified flag service initialized",
          countryCount: initCountryNames.length,
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use ?action=update or ?action=initialize",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[FlagCache API] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await requireAdminAccess();
    if (!authCheck.authorized) {
      return authCheck.error;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "clear":
        await serverFlagResolver.clear();

        return NextResponse.json({
          success: true,
          message: "All flag caches cleared (including local files)",
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use ?action=clear",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[FlagCache API] DELETE error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
