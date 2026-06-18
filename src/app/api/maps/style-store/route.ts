import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { join } from "path";
import { readFile } from "fs/promises";
import { getMapGlyphsUrl } from "~/lib/base-path";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isSystemOwner(session.userId)) {
      const role = (session.sessionClaims?.metadata as any)?.role;
      if (!["admin", "owner", "staff"].includes(role)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const theme = searchParams.get("theme");
    if (!theme || !["standard", "dark", "paper"].includes(theme)) {
      return NextResponse.json({ error: "Invalid theme parameter" }, { status: 400 });
    }

    let styleJson: any;

    // 1. Check database first
    const override = await db.mapStyleOverride.findUnique({
      where: { theme },
    });

    if (override) {
      styleJson = override.styleJson;
    } else {
      // 2. Fall back to local file template
      const filePath = join(process.cwd(), "src", "lib", "map-styles", `${theme}.json`);
      const fileContent = await readFile(filePath, "utf-8");
      styleJson = JSON.parse(fileContent);
    }

    // 3. Set glyphs URL dynamically so Maputnik can load fonts
    styleJson.glyphs = getMapGlyphsUrl();

    // 4. Update data URLs of geojson sources for Maputnik preview
    if (styleJson.sources) {
      for (const [key, source] of Object.entries(styleJson.sources as Record<string, any>)) {
        if (source.type === "geojson") {
          source.data = `/api/maps/editor-source/${key}`;
        }
      }
    }

    return NextResponse.json(styleJson, { status: 200 });
  } catch (error) {
    console.error("❌ GET /api/maps/style-store failed:", error);
    return NextResponse.json(
      {
        error: "Failed to load style",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isSystemOwner(session.userId)) {
      const role = (session.sessionClaims?.metadata as any)?.role;
      if (!["admin", "owner", "staff"].includes(role)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const theme = searchParams.get("theme");
    if (!theme || !["standard", "dark", "paper"].includes(theme)) {
      return NextResponse.json({ error: "Invalid theme parameter" }, { status: 400 });
    }

    const body = await request.json();

    // Clean data URLs of geojson sources before saving to DB
    if (body.sources) {
      for (const source of Object.values(body.sources as Record<string, any>)) {
        if (source.type === "geojson" && typeof source.data === "string" && source.data.startsWith("/api/maps/editor-source/")) {
          source.data = { type: "FeatureCollection", features: [] };
        }
      }
    }

    // Save style to DB
    const override = await db.mapStyleOverride.upsert({
      where: { theme },
      update: { styleJson: body },
      create: { theme, styleJson: body },
    });

    return NextResponse.json({ success: true, override }, { status: 200 });
  } catch (error) {
    console.error("❌ PUT /api/maps/style-store failed:", error);
    return NextResponse.json(
      {
        error: "Failed to save style",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
