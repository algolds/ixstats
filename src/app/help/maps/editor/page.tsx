"use client";

import { Edit3, MapPin, Building, Crosshair } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function MapEditorArticle() {
  return (
    <ArticleLayout
      title="Interactive Map Editor"
      description="Create and manage subdivisions, cities, points of interest, and custom map layers with the visual map editor interface."
      icon={Edit3}
    >
      <Section title="Editor Capabilities">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Subdivisions:</strong> Define provinces, states, regions, territories with
            custom boundaries and metadata.
          </li>
          <li>
            <strong>Cities & Settlements:</strong> Place cities, towns, villages with population,
            coordinates, and classification.
          </li>
          <li>
            <strong>Points of Interest:</strong> Mark landmarks, military bases, airports, seaports,
            cultural sites, infrastructure.
          </li>
          <li>
            <strong>Custom Layers:</strong> Create thematic overlays (climate zones, economic
            regions, electoral districts).
          </li>
        </ul>
      </Section>

      <Section title="Editing Workflow">
        <InfoBox title="Step-by-Step">
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              <strong>Access Editor:</strong> Navigate to <code>/admin/map-editor</code> (requires
              ADMIN or MAP_EDITOR role).
            </li>
            <li>
              <strong>Select Layer:</strong> Choose subdivision, city, or POI layer to edit.
            </li>
            <li>
              <strong>Draw Features:</strong> Use polygon, point, or line tools to create geometries
              on the map.
            </li>
            <li>
              <strong>Add Metadata:</strong> Fill in names, classifications, populations, parent
              relationships.
            </li>
            <li>
              <strong>Preview:</strong> Review changes in preview mode before publishing.
            </li>
            <li>
              <strong>Publish:</strong> Save to database; tiles automatically regenerated with new
              data.
            </li>
          </ol>
        </InfoBox>
      </Section>

      <Section title="Subdivision Management">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Hierarchy Support:</strong> Multi-level admin divisions (country →
            province/state → county → municipality).
          </li>
          <li>
            <strong>Boundary Validation:</strong> Automatic checks for overlaps, gaps, invalid
            geometries.
          </li>
          <li>
            <strong>Population Data:</strong> Assign populations with automatic rollup to parent
            levels.
          </li>
          <li>
            <strong>Classification Tags:</strong> Mark as federal subject, autonomous region,
            special territory, etc.
          </li>
        </ul>
      </Section>

      <Section title="City & POI Features">
        <InfoBox title="Location Metadata">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Cities:</strong> Name, coordinates, population, subdivision, city type
              (capital, major, town, village).
            </li>
            <li>
              <strong>POIs:</strong> Type (military, civilian, infrastructure), coordinates, name,
              description, visibility.
            </li>
            <li>
              <strong>Clustering:</strong> Automatic marker clustering at high zoom levels for
              performance.
            </li>
            <li>
              <strong>Search Integration:</strong> Cities and POIs indexed for location search.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="API Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code>api.mapEditor.getSubdivisions</code> – List all subdivisions with hierarchy.
          </li>
          <li>
            <code>api.mapEditor.createSubdivision</code> – Add new subdivision with geometry.
          </li>
          <li>
            <code>api.mapEditor.getCities</code> – Retrieve cities with population and coordinates.
          </li>
          <li>
            <code>api.mapEditor.createPOI</code> – Add point of interest with metadata.
          </li>
          <li>
            <code>api.geo.validateGeometry</code> – Check geometry validity before saving.
          </li>
          <li>
            Router provides 18 procedures (7 queries, 11 mutations) for complete map editing.
          </li>
        </ul>
      </Section>

      <Section title="GIS Integration">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            All geometries stored as PostGIS geographies with WGS84 (SRID 4326) projection.
          </li>
          <li>
            Spatial indexes automatically created for efficient querying and tile generation.
          </li>
          <li>
            Geometry validation using PostGIS ST_IsValid and ST_MakeValid functions.
          </li>
          <li>
            Import/export support for GeoJSON, KML, Shapefile formats (coming in v1.5).
          </li>
        </ul>
      </Section>

      <Section title="Performance Considerations">
        <InfoBox title="Optimization Best Practices">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <MapPin className="inline h-4 w-4" /> Simplify geometries for performance; use
              ST_Simplify for complex polygons.
            </li>
            <li>
              <Building className="inline h-4 w-4" /> Limit POIs to essential locations; excessive
              markers degrade performance.
            </li>
            <li>
              <Crosshair className="inline h-4 w-4" /> After major edits, run tile pre-generation to
              refresh cache.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>docs/systems/map-system.md</code> – Map architecture and GIS integration.
          </li>
          <li>
            <code>docs/VECTOR_TILES_COMPLETE_GUIDE.md</code> – Tile generation and caching.
          </li>
          <li>
            <code>/help/maps/vector-tiles</code> – Understanding the vector tile system.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
