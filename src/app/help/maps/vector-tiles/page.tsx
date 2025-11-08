"use client";

import { Map, Zap, Database, Layers } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function VectorTilesArticle() {
  return (
    <ArticleLayout
      title="Vector Tile Map System"
      description="High-performance mapping with 100-1000x speed improvement through Martin tile server, Redis caching, and pre-generation."
      icon={Map}
    >
      <Section title="Performance Architecture">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Martin v0.19.3:</strong> Rust-based tile server generating vector tiles directly
            from PostGIS database.
          </li>
          <li>
            <strong>Redis Caching:</strong> In-memory tile cache with 30-day TTL, 2GB limit, LRU
            eviction policy.
          </li>
          <li>
            <strong>Pre-Generation:</strong> Critical tiles (zoom 0-5) generated on startup for
            instant access.
          </li>
          <li>
            <strong>MapLibre GL JS:</strong> Client-side rendering with GPU acceleration for smooth
            interactions.
          </li>
        </ul>
      </Section>

      <Section title="Performance Metrics">
        <InfoBox title="Before & After Comparison">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="py-2 text-left">Phase</th>
                <th className="py-2 text-left">Performance</th>
                <th className="py-2 text-left">Improvement</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2">Before (Prisma)</td>
                <td className="py-2">1000-1150ms</td>
                <td className="py-2 text-slate-500">Baseline</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2">Martin Server</td>
                <td className="py-2">58-220ms</td>
                <td className="py-2 text-emerald-600 dark:text-emerald-400">5-17x faster</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <td className="py-2">+ Redis Cache</td>
                <td className="py-2">&lt;50ms</td>
                <td className="py-2 text-emerald-600 dark:text-emerald-400">20-50x faster</td>
              </tr>
              <tr>
                <td className="py-2">+ Pre-generation</td>
                <td className="py-2">&lt;10ms</td>
                <td className="py-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  100-1000x faster
                </td>
              </tr>
            </tbody>
          </table>
        </InfoBox>
      </Section>

      <Section title="Map Layers">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Political Boundaries:</strong> Countries, subdivisions, administrative regions
            with sovereignty data.
          </li>
          <li>
            <strong>Physical Geography:</strong> Coastlines, ice caps, major water bodies, terrain
            features.
          </li>
          <li>
            <strong>Altitude Data:</strong> Elevation contours, mountain ranges, depth soundings.
          </li>
          <li>
            <strong>Rivers & Waterways:</strong> Major rivers, lakes, canals, international
            waterways.
          </li>
          <li>
            All layers stored as PostGIS geometries with spatial indexes for efficient querying.
          </li>
        </ul>
      </Section>

      <Section title="Cache Strategy">
        <InfoBox title="3-Tier Caching System">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Browser Cache:</strong> MapLibre caches tiles locally; eliminates repeat
              requests.
            </li>
            <li>
              <strong>Redis Cache:</strong> Shared server-side cache with 85-95% hit rate after
              warm-up.
            </li>
            <li>
              <strong>Martin Server:</strong> Generates tiles on-demand from PostGIS; expensive but
              rare.
            </li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="API Endpoints">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code>/api/tiles/political/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;</code> – Political
            boundary tiles (MVT format).
          </li>
          <li>
            <code>/api/tiles/icecaps/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;</code> – Ice cap and
            glacier tiles.
          </li>
          <li>
            <code>/api/tiles/altitudes/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;</code> – Elevation
            and terrain tiles.
          </li>
          <li>
            <code>/api/tiles/rivers/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;</code> – River and
            waterway tiles.
          </li>
          <li>
            All endpoints support gzip compression; tiles typically 5-50KB compressed.
          </li>
        </ul>
      </Section>

      <Section title="Map Editor Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Interactive map editor at <code>/admin/map-editor</code> for subdivisions, cities, POIs.
          </li>
          <li>
            Changes to geometries automatically invalidate relevant tiles in Redis cache.
          </li>
          <li>
            Preview mode shows edits immediately; publish to update live map data.
          </li>
          <li>
            See <code>/help/maps/editor</code> for complete map editing workflow.
          </li>
        </ul>
      </Section>

      <WarningBox title="Production Operations">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <Zap className="inline h-4 w-4" /> Run <code>/scripts/martin-tiles.sh start</code> to
            launch Martin + Redis stack.
          </li>
          <li>
            <Database className="inline h-4 w-4" /> Monitor cache hit rates via{" "}
            <code>/admin/map-monitoring</code> dashboard.
          </li>
          <li>
            <Layers className="inline h-4 w-4" /> Pre-generate critical tiles with{" "}
            <code>npm run tiles:pregenerate</code> after schema changes.
          </li>
        </ul>
      </WarningBox>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>docs/systems/map-system.md</code> – Complete technical reference with architecture
            diagrams.
          </li>
          <li>
            <code>docs/VECTOR_TILES_COMPLETE_GUIDE.md</code> – Setup, operations, troubleshooting.
          </li>
          <li>
            <code>/help/maps/editor</code> – Using the map editor interface.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
