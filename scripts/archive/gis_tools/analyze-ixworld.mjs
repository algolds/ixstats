/**
 * Analyze real IxWorld GeoJSON data to extract geometry metrics
 * for calibrating the procedural world generator.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'scripts', 'geojson_fixed');

const layers = ['political', 'altitudes', 'climate', 'rivers', 'lakes', 'icecaps', 'background'];

function countVertices(geometry) {
  if (!geometry) return 0;
  let count = 0;
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) count += ring.length;
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates)
      for (const ring of poly) count += ring.length;
  } else if (geometry.type === 'LineString') {
    count = geometry.coordinates.length;
  } else if (geometry.type === 'MultiLineString') {
    for (const line of geometry.coordinates) count += line.length;
  } else if (geometry.type === 'Point') {
    count = 1;
  }
  return count;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(area / 2);
}

function featureArea(geometry) {
  if (!geometry) return 0;
  let area = 0;
  if (geometry.type === 'Polygon') {
    area = ringArea(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      area += ringArea(poly[0]);
    }
  }
  return area;
}

function convexHullArea(points) {
  if (points.length < 3) return 0;
  // Graham scan
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  hull.push(hull[0]);
  return ringArea(hull);
}

function featureConvexity(geometry) {
  if (!geometry) return 1;
  let allPoints = [];
  let totalArea = 0;
  if (geometry.type === 'Polygon') {
    allPoints = geometry.coordinates[0];
    totalArea = ringArea(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      allPoints = allPoints.concat(poly[0]);
      totalArea += ringArea(poly[0]);
    }
  }
  if (allPoints.length < 3 || totalArea === 0) return 1;
  const hullArea = convexHullArea(allPoints);
  return hullArea > 0 ? totalArea / hullArea : 1;
}

function ringPerimeter(ring) {
  let perim = 0;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i-1][0];
    const dy = ring[i][1] - ring[i-1][1];
    perim += Math.sqrt(dx * dx + dy * dy);
  }
  return perim;
}

function featurePerimeter(geometry) {
  if (!geometry) return 0;
  let perim = 0;
  if (geometry.type === 'Polygon') {
    perim = ringPerimeter(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) perim += ringPerimeter(poly[0]);
  }
  return perim;
}

function percentile(arr, p) {
  const idx = Math.floor(arr.length * p);
  return arr[Math.min(idx, arr.length - 1)];
}

function computeGini(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let cumulativeSum = 0;
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    cumulativeSum += sorted[i];
    giniSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return giniSum / (n * total);
}

// Analyze each layer
for (const layer of layers) {
  const fp = join(dir, layer + '.geojson');
  if (!existsSync(fp)) {
    console.log(`\n=== ${layer.toUpperCase()} === NOT FOUND`);
    continue;
  }
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const features = data.features || [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== ${layer.toUpperCase()} ===`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Feature count: ${features.length}`);

  // Geometry type distribution
  const types = {};
  for (const f of features) {
    const t = f.geometry?.type || 'null';
    types[t] = (types[t] || 0) + 1;
  }
  console.log(`Geometry types: ${JSON.stringify(types)}`);

  // Vertex counts
  const vertexCounts = features.map(f => countVertices(f.geometry)).filter(v => v > 0);
  if (vertexCounts.length > 0) {
    vertexCounts.sort((a, b) => a - b);
    const sum = vertexCounts.reduce((s, v) => s + v, 0);
    console.log(`\nVertex Statistics:`);
    console.log(`  Total vertices: ${sum.toLocaleString()}`);
    console.log(`  Avg per feature: ${(sum / vertexCounts.length).toFixed(1)}`);
    console.log(`  Min: ${vertexCounts[0]}, Max: ${vertexCounts[vertexCounts.length - 1]}`);
    console.log(`  p10: ${percentile(vertexCounts, 0.1)}, Median: ${percentile(vertexCounts, 0.5)}, p90: ${percentile(vertexCounts, 0.9)}`);
  }

  // Area and convexity (for polygon layers)
  if (layer !== 'rivers') {
    const areas = features.map(f => featureArea(f.geometry)).filter(a => a > 0);
    const convexities = features.map(f => featureConvexity(f.geometry)).filter(c => c < 1.01 && c > 0);

    if (areas.length > 0) {
      areas.sort((a, b) => a - b);
      const totalArea = areas.reduce((s, v) => s + v, 0);
      console.log(`\nArea Statistics (degrees²):`);
      console.log(`  Total area: ${totalArea.toFixed(2)}`);
      console.log(`  Avg: ${(totalArea / areas.length).toFixed(3)}`);
      console.log(`  Min: ${areas[0].toFixed(4)}, Max: ${areas[areas.length - 1].toFixed(3)}`);
      console.log(`  Median: ${percentile(areas, 0.5).toFixed(4)}`);
      console.log(`  Gini coefficient: ${computeGini(areas).toFixed(3)}`);
    }

    if (convexities.length > 0) {
      convexities.sort((a, b) => a - b);
      const avgConvexity = convexities.reduce((s, v) => s + v, 0) / convexities.length;
      console.log(`\nConvexity (area/convex_hull_area):`);
      console.log(`  Avg: ${avgConvexity.toFixed(3)}`);
      console.log(`  Min: ${convexities[0].toFixed(3)}, Max: ${convexities[convexities.length - 1].toFixed(3)}`);
      console.log(`  p10: ${percentile(convexities, 0.1).toFixed(3)}, Median: ${percentile(convexities, 0.5).toFixed(3)}, p90: ${percentile(convexities, 0.9).toFixed(3)}`);
    }
  }

  // Coastline complexity for political
  if (layer === 'political') {
    const complexities = [];
    for (const f of features) {
      const area = featureArea(f.geometry);
      const perim = featurePerimeter(f.geometry);
      if (area > 0 && perim > 0) {
        complexities.push(perim / Math.sqrt(area));
      }
    }
    if (complexities.length > 0) {
      complexities.sort((a, b) => a - b);
      const avg = complexities.reduce((s, v) => s + v, 0) / complexities.length;
      console.log(`\nCoastline Complexity (perimeter/sqrt(area)):`);
      console.log(`  Avg: ${avg.toFixed(2)}, Stddev: ${Math.sqrt(complexities.reduce((s, v) => s + (v - avg) ** 2, 0) / complexities.length).toFixed(2)}`);
      console.log(`  Min: ${complexities[0].toFixed(2)}, Max: ${complexities[complexities.length - 1].toFixed(2)}`);
      console.log(`  Median: ${percentile(complexities, 0.5).toFixed(2)}`);
    }

    // Country names
    const names = features.map(f => f.properties?.id || f.properties?._displayName || 'unknown');
    console.log(`\nCountry names (first 10): ${names.slice(0, 10).join(', ')}`);
    console.log(`Total countries: ${names.length}`);
  }

  // Elevation zone analysis
  if (layer === 'altitudes') {
    const fills = {};
    for (const f of features) {
      const fill = f.properties?.fill || f.properties?.color || 'unknown';
      fills[fill] = (fills[fill] || 0) + 1;
    }
    console.log(`\nFill colors (elevation zones):`);
    const sortedFills = Object.entries(fills).sort((a, b) => b[1] - a[1]);
    for (const [color, count] of sortedFills) {
      const areaForColor = features
        .filter(f => (f.properties?.fill || f.properties?.color) === color)
        .reduce((s, f) => s + featureArea(f.geometry), 0);
      console.log(`  ${color}: ${count} features, area=${areaForColor.toFixed(2)} deg²`);
    }
  }

  // Rivers analysis
  if (layer === 'rivers') {
    const lengths = [];
    for (const f of features) {
      const g = f.geometry;
      if (!g) continue;
      let len = 0;
      if (g.type === 'LineString') {
        len = ringPerimeter(g.coordinates);
      } else if (g.type === 'MultiLineString') {
        for (const line of g.coordinates) len += ringPerimeter(line);
      } else if (g.type === 'Polygon') {
        len = ringPerimeter(g.coordinates[0]);
      }
      lengths.push(len);
    }
    if (lengths.length > 0) {
      lengths.sort((a, b) => a - b);
      console.log(`\nRiver Lengths (degrees):`);
      console.log(`  Avg: ${(lengths.reduce((s,v) => s+v, 0) / lengths.length).toFixed(3)}`);
      console.log(`  Min: ${lengths[0].toFixed(4)}, Max: ${lengths[lengths.length - 1].toFixed(3)}`);
      console.log(`  Median: ${percentile(lengths, 0.5).toFixed(3)}`);
    }

    // River geometry types
    const riverTypes = {};
    for (const f of features) {
      riverTypes[f.geometry?.type] = (riverTypes[f.geometry?.type] || 0) + 1;
    }
    console.log(`  River geometry types: ${JSON.stringify(riverTypes)}`);
  }
}

// Summary comparison table
console.log(`\n${'='.repeat(60)}`);
console.log(`=== IXWORLD REFERENCE METRICS SUMMARY ===`);
console.log(`${'='.repeat(60)}`);

const political = JSON.parse(readFileSync(join(dir, 'political.geojson'), 'utf-8'));
const altitudes = JSON.parse(readFileSync(join(dir, 'altitudes.geojson'), 'utf-8'));
const climate = JSON.parse(readFileSync(join(dir, 'climate.geojson'), 'utf-8'));
const rivers = JSON.parse(readFileSync(join(dir, 'rivers.geojson'), 'utf-8'));
const lakes = JSON.parse(readFileSync(join(dir, 'lakes.geojson'), 'utf-8'));
const icecaps = JSON.parse(readFileSync(join(dir, 'icecaps.geojson'), 'utf-8'));

console.log(`
Layer             | Count | Avg Vertices | Median Vertices
------------------+-------+--------------+----------------
Political         |  ${political.features.length.toString().padStart(4)} | ${(political.features.reduce((s,f) => s + countVertices(f.geometry), 0) / political.features.length).toFixed(0).padStart(12)} | ${(() => { const v = political.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
Altitudes         |  ${altitudes.features.length.toString().padStart(4)} | ${(altitudes.features.reduce((s,f) => s + countVertices(f.geometry), 0) / altitudes.features.length).toFixed(0).padStart(12)} | ${(() => { const v = altitudes.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
Climate           |  ${climate.features.length.toString().padStart(4)} | ${(climate.features.reduce((s,f) => s + countVertices(f.geometry), 0) / climate.features.length).toFixed(0).padStart(12)} | ${(() => { const v = climate.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
Rivers            |  ${rivers.features.length.toString().padStart(4)} | ${(rivers.features.reduce((s,f) => s + countVertices(f.geometry), 0) / rivers.features.length).toFixed(0).padStart(12)} | ${(() => { const v = rivers.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
Lakes             |  ${lakes.features.length.toString().padStart(4)} | ${(lakes.features.reduce((s,f) => s + countVertices(f.geometry), 0) / lakes.features.length).toFixed(0).padStart(12)} | ${(() => { const v = lakes.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
Icecaps           |  ${icecaps.features.length.toString().padStart(4)} | ${(icecaps.features.reduce((s,f) => s + countVertices(f.geometry), 0) / icecaps.features.length).toFixed(0).padStart(12)} | ${(() => { const v = icecaps.features.map(f => countVertices(f.geometry)).sort((a,b) => a-b); return v[Math.floor(v.length/2)]; })().toString().padStart(15)}
`);
