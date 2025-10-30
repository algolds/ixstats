// Calculate the correct scale factor based on canonical country sizes

// Unscaled areas (PostGIS calculations using Earth's ellipsoid)
const unscaled = {
  "Caphiria": 1818323,
  "Cartadania": 1345448,
  "Urcea": 1906572,
};

// Canonical sizes (from IxWiki lore)
const canonical = {
  "Caphiria": 2300000,
  "Cartadania": 1591610,
  "Urcea": 2000000,
};

console.log("📊 Scale Factor Analysis\n");
console.log("Scale factors needed for each country:");
for (const country in canonical) {
  const factor = canonical[country] / unscaled[country];
  console.log(`  ${country}: ${factor.toFixed(4)}x (${unscaled[country].toLocaleString()} → ${canonical[country].toLocaleString()} sq mi)`);
}

const factors = Object.keys(canonical).map(c => canonical[c] / unscaled[c]);
const avgFactor = factors.reduce((a, b) => a + b, 0) / factors.length;
const medianFactor = factors.sort()[1]; // Middle value of 3

console.log(`\n📈 Statistical Summary:`);
console.log(`  Average: ${avgFactor.toFixed(4)}x`);
console.log(`  Median: ${medianFactor.toFixed(4)}x`);
console.log(`  Range: ${Math.min(...factors).toFixed(4)}x - ${Math.max(...factors).toFixed(4)}x`);

console.log(`\n🌍 Planet Comparison:`);
console.log(`  IxEarth total area: 352,800,000 sq mi`);
console.log(`  Earth total area: 196,940,000 sq mi`);
console.log(`  Planet scale ratio: 1.7914x`);
console.log(`  Actual scale needed: ${avgFactor.toFixed(4)}x`);
console.log(`  Discrepancy: ${(1.7914 / avgFactor).toFixed(4)}x`);

console.log(`\n💡 Recommendation:`);
console.log(`  Use scale factor: ${medianFactor.toFixed(4)}x`);
console.log(`  This balances the canonical sizes of major countries.`);
