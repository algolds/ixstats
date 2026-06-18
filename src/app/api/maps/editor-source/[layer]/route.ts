import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { loadLayerFromDB } from "~/server/api/routers/geo/core/layer-loader";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string }> }
) {
  try {
    const { layer } = await params;
    
    let dbLayerType = layer;
    if (layer.startsWith("source-")) {
      dbLayerType = layer.replace("source-", "");
    }

    // 1. Check for specific overlay layers and query their respective tables
    if (dbLayerType === "capitals") {
      const capitalCities = await db.city.findMany({
        where: { isNationalCapital: true, status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          population: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      });

      const features = capitalCities
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
          properties: {
            id: c.id,
            name: c.name,
            countryId: c.countryId,
            countryName: c.country?.name || "",
            countrySlug: c.country?.slug || "",
            population: c.population,
            wikiPageTitle: c.wikiPageTitle,
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "overlay-subdivisions" || dbLayerType === "subdivisions") {
      const subdivisions = await db.subdivision.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          level: true,
          areaSqKm: true,
          geometry: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      });

      const features = subdivisions
        .filter((s) => s.geometry)
        .map((s) => ({
          type: "Feature" as const,
          geometry: s.geometry as any,
          properties: {
            id: s.id,
            name: s.name,
            subdivisionType: s.type,
            level: s.level,
            areaSqKm: s.areaSqKm,
            countryId: s.countryId,
            countryName: s.country?.name || "",
            countrySlug: s.country?.slug || "",
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "overlay-cities" || dbLayerType === "cities") {
      const cities = await db.city.findMany({
        where: { isNationalCapital: false, status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          population: true,
          type: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      });

      const features = cities
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
          properties: {
            id: c.id,
            name: c.name,
            cityType: c.type,
            isCapital: false,
            population: c.population,
            countryId: c.countryId,
            countryName: c.country?.name || "",
            countrySlug: c.country?.slug || "",
            wikiPageTitle: c.wikiPageTitle,
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "overlay-pois" || dbLayerType === "pois") {
      const pois = await db.pointOfInterest.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          category: true,
          icon: true,
          description: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      });

      const features = pois
        .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
        .map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
          properties: {
            id: p.id,
            name: p.name,
            category: p.category,
            icon: p.icon,
            description: p.description,
            wikiPageTitle: p.wikiPageTitle,
            countryId: p.countryId,
            countryName: p.country?.name || "",
            countrySlug: p.country?.slug || "",
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "story-pins" || dbLayerType === "storyPins") {
      const storyPins = await db.storyPin.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          title: true,
          category: true,
          coordinates: true,
          importance: true,
          content: true,
          wikiPageTitle: true,
          countryId: true,
        },
      });

      const features = storyPins
        .filter((sp) => Array.isArray(sp.coordinates) && (sp.coordinates as number[]).length >= 2)
        .map((sp) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: sp.coordinates as [number, number] },
          properties: {
            id: sp.id,
            title: sp.title,
            category: sp.category,
            importance: sp.importance,
            content: sp.content,
            wikiPageTitle: sp.wikiPageTitle,
            countryId: sp.countryId,
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    if (dbLayerType === "map-labels" || dbLayerType === "mapLabels") {
      const mapLabels = await db.mapLabel.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          text: true,
          labelType: true,
          coordinates: true,
          fontSize: true,
          color: true,
          rotation: true,
          letterSpacing: true,
          fontWeight: true,
          opacity: true,
          minZoom: true,
          maxZoom: true,
        },
      });

      const features = mapLabels
        .filter((ml) => Array.isArray(ml.coordinates) && (ml.coordinates as number[]).length >= 2)
        .map((ml) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: ml.coordinates as [number, number] },
          properties: {
            id: ml.id,
            text: ml.text,
            labelType: ml.labelType,
            fontSize: ml.fontSize,
            color: ml.color,
            rotation: ml.rotation,
            letterSpacing: ml.letterSpacing,
            fontWeight: ml.fontWeight,
            opacity: ml.opacity,
            minZoom: ml.minZoom,
            maxZoom: ml.maxZoom,
          },
        }));

      return NextResponse.json({ type: "FeatureCollection", features }, { status: 200 });
    }

    // Handle country-labels/country_labels mapping
    if (dbLayerType === "country-labels") {
      dbLayerType = "country_labels";
    }

    // 2. Default fallback to base layers in MapLayer table
    const fc = await loadLayerFromDB(db, dbLayerType, 2);
    if (!fc) {
      return NextResponse.json(
        { type: "FeatureCollection", features: [] },
        { status: 200 }
      );
    }

    return NextResponse.json(fc, { status: 200 });
  } catch (error) {
    console.error("❌ Map editor source query failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch map layer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
