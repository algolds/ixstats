import * as fs from "fs";

const raw = fs.readFileSync("/home/jxsig/projects/ixstats/scripts/reports/caphiria-24-regions.json", "utf-8");
const data = JSON.parse(raw);

const subds = data.caphiriaSubdivisions;

console.log(`Total Caphiria subdivisions: ${subds.length}`);

const summary = subds.map((s: any, idx: number) => {
  return {
    index: idx + 1,
    id: s.id,
    name: s.name,
    type: s.type,
    level: s.level,
    capital: s.capital,
    areaSqKm: Math.round(s.areaSqKm),
    population: s.population,
    climates: s.climateProfile?.map((c: any) => `${c.name} (${c.percentArea}%)`).join(", ") || "None",
    elevations: s.elevationProfile?.map((e: any) => `${e.name} (${e.percentArea}%)`).join(", ") || "None",
    waterAccess: s.waterAccess ? {
      hasRiver: s.waterAccess.hasRiver,
      riverLengthKm: Math.round(s.waterAccess.riverLengthKm || 0),
      hasLake: s.waterAccess.hasLake,
      lakeAreaSqKm: Math.round(s.waterAccess.lakeAreaSqKm || 0),
    } : null,
  };
});

fs.writeFileSync(
  "/home/jxsig/projects/ixstats/scripts/reports/24-regions-summary.json",
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
