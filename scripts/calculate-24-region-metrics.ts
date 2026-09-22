import * as fs from "fs";
import * as turf from "@turf/turf";

const raw = fs.readFileSync("/home/jxsig/projects/ixstats/scripts/reports/caphiria-24-regions.json", "utf-8");
const data = JSON.parse(raw);

const subds = data.caphiriaSubdivisions;

const results = subds.map((s: any, idx: number) => {
  const feat = turf.feature(s.geometry);
  const calculatedAreaKm2 = Math.round(turf.area(feat) / 1e6);
  const bbox = turf.bbox(feat);
  const centroid = turf.centroid(feat);

  return {
    index: idx + 1,
    id: s.id,
    name: s.name,
    type: s.type,
    level: s.level,
    capital: s.capital,
    dbAreaSqKm: Math.round(s.areaSqKm || 0),
    calculatedAreaKm2,
    population: s.population || 0,
    centroid: [
      Number(centroid.geometry.coordinates[0].toFixed(2)),
      Number(centroid.geometry.coordinates[1].toFixed(2)),
    ],
    bbox: [
      Number(bbox[0].toFixed(2)),
      Number(bbox[1].toFixed(2)),
      Number(bbox[2].toFixed(2)),
      Number(bbox[3].toFixed(2)),
    ],
    climates: s.climateProfile || [],
    elevations: s.elevationProfile || [],
    waterAccess: s.waterAccess || {
      hasRiver: false,
      riverLengthKm: 0,
      hasLake: false,
      lakeAreaSqKm: 0,
    },
  };
});

fs.writeFileSync(
  "/home/jxsig/projects/ixstats/scripts/reports/24-regions-full-metrics.json",
  JSON.stringify(results, null, 2)
);

console.log("Calculated metrics for all 24 regions:");
for (const r of results) {
  console.log(`${r.index}. ${r.name}: ${r.calculatedAreaKm2.toLocaleString()} km², Pop: ${r.population ? r.population.toLocaleString() : 'N/A'}, Centroid: [${r.centroid[0]}°E, ${r.centroid[1]}°S]`);
}
