import * as fs from "fs";

const raw = fs.readFileSync("/home/jxsig/projects/ixstats/scripts/reports/24-regions-full-metrics.json", "utf-8");
const regions = JSON.parse(raw);

let md = `## Regional and provincial geographical reports

In the map editor and administrative database, Caphiria divides into twenty-four regional provinces created through the map editor region tool. Each province possesses unique spatial boundaries, hypsometric terrain profiles, climatic regimes, and hydrological drainage systems recorded directly in the national geographic registry.

\`\`\`
+-----------------------------------------------------------------------------------------------+
|                             CAPHIRIA TWENTY-FOUR REGIONS (MAP EDITOR)                         |
+-----------------------------------------------------------------------------------------------+
| #   Province Name        Area (km²)     Population     Dominant Climate      Elevation Focus  |
| :-- | :----------------- | :----------- | :----------- | :------------------ | :-------------- |
`;

for (const r of regions) {
  const num = String(r.index).padEnd(3);
  const name = r.name.padEnd(20);
  const area = `${(r.dbAreaSqKm > 0 ? r.dbAreaSqKm : r.calculatedAreaKm2).toLocaleString()} km²`.padEnd(14);
  const pop = (r.population > 0 ? r.population.toLocaleString() : "Unassigned").padEnd(14);
  
  // Dominant climate
  const domClim = r.climates.length > 0 ? r.climates[0].name.split("(")[0].trim() : "Unclassified";
  const climStr = domClim.slice(0, 20).padEnd(21);
  
  // Dominant elev
  const domElev = r.elevations.length > 0 ? r.elevations[0].name.split("(")[0].trim() : "Lowlands";
  const elevStr = domElev.slice(0, 15);

  md += `| ${num} | ${name} | ${area} | ${pop} | ${climStr} | ${elevStr} |\n`;
}

md += `+-----------------------------------------------------------------------------------------------+
\`\`\`
`;

for (const r of regions) {
  const area = r.dbAreaSqKm > 0 ? r.dbAreaSqKm : r.calculatedAreaKm2;
  const popStr = r.population > 0 ? `${r.population.toLocaleString()} inhabitants` : "Unassigned in regional census registry";
  
  // Climates
  const climList = r.climates.map((c: any) => `${c.name}: ${c.percentArea}% (${Math.round(c.areaSqKm).toLocaleString()} km²)`).join(", ");
  
  // Elevations
  const elevList = r.elevations.map((e: any) => `${e.name} [${e.minElev} to ${e.maxElev} m]: ${e.percentArea}% (${Math.round(e.areaSqKm).toLocaleString()} km²)`).join(", ");
  
  // Hydro
  let hydroStr = "";
  if (r.waterAccess.hasRiver && r.waterAccess.hasLake) {
    hydroStr = `Traversed by ${Math.round(r.waterAccess.riverLengthKm).toLocaleString()} kilometers of mapped river channels and contains ${Math.round(r.waterAccess.lakeAreaSqKm).toLocaleString()} square kilometers of mapped lake basins.`;
  } else if (r.waterAccess.hasRiver) {
    hydroStr = `Traversed by ${Math.round(r.waterAccess.riverLengthKm).toLocaleString()} kilometers of mapped river channels. No major lake basins are mapped within the provincial perimeter.`;
  } else if (r.waterAccess.hasLake) {
    hydroStr = `Contains ${Math.round(r.waterAccess.lakeAreaSqKm).toLocaleString()} square kilometers of mapped lake basins without mapped primary continental riverways.`;
  } else {
    hydroStr = `No major mapped continental river channels or lake basins within the provincial perimeter. Drainage relies on localized coastal runoff and subterranean groundwater aquifers.`;
  }

  md += `
### ${r.index}. ${r.name} Province

- Administrative classification: Level ${r.level} ${r.type}.
- Territorial surface area: ${area.toLocaleString()} square kilometers (${Math.round(area * 0.386102).toLocaleString()} square miles).
- Registered population: ${popStr}.
- Geographic coordinates: Centroid at ${Math.abs(r.centroid[1])}°S latitude, ${r.centroid[0]}°E longitude. Bounding box extends from ${Math.abs(r.bbox[3])}°S to ${Math.abs(r.bbox[1])}°S latitude and ${r.bbox[0]}°E to ${r.bbox[2]}°E longitude.
- Hypsometry and terrain: ${elevList}.
- Climatic regime: ${climList}.
- Hydrography and water systems: ${hydroStr}
`;
}

fs.writeFileSync("/home/jxsig/projects/ixstats/scripts/reports/24-regions-section.md", md);
console.log("Generated markdown length:", md.length);
