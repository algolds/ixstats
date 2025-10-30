/**
 * Projection System Validation Script
 * Ensures ONLY useProjectionTransition handles projections
 *
 * Run: npx tsx scripts/validate-projection-system.ts
 */

import * as fs from "fs";
import * as path from "path";

const ERRORS: string[] = [];
const WARNINGS: string[] = [];

console.log("🔍 Validating projection system...\n");

// Files that should NEVER touch projections
const FORBIDDEN_FILES = [
  "src/hooks/maps/useMapInstance.ts",
  "src/hooks/maps/useSelectedCountryTerrain.ts",
  "src/hooks/maps/useGeographicReferenceLayers.ts",
  "src/hooks/maps/useVectorTileLayers.ts",
  "src/app/maps/page.tsx",
];

// Forbidden patterns in forbidden files
const FORBIDDEN_PATTERNS = [
  { pattern: /setProjection\s*\(/, message: "setProjection call found" },
  { pattern: /setFog\s*\(/, message: "setFog call found" },
  { pattern: /projection:\s*{\s*type:/, message: "projection config found" },
];

// Check forbidden files
for (const file of FORBIDDEN_FILES) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    WARNINGS.push(`⚠️  ${file}: File not found (skipping)`);
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf-8");

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      ERRORS.push(`❌ ${file}: ${message}`);
    }
  }
}

// Check useProjectionTransition has exactly ONE setProjection call
const projTransPath = path.join(process.cwd(), "src/hooks/maps/useProjectionTransition.ts");
if (!fs.existsSync(projTransPath)) {
  ERRORS.push("❌ useProjectionTransition.ts: File not found!");
} else {
  const projTransContent = fs.readFileSync(projTransPath, "utf-8");

  // Count setProjection calls (should be exactly 1)
  const setProjectionCalls = (projTransContent.match(/map\.current\.setProjection\s*\(/g) || [])
    .length;
  if (setProjectionCalls !== 1) {
    ERRORS.push(
      `❌ useProjectionTransition.ts: Expected 1 setProjection call, found ${setProjectionCalls}`
    );
  }

  // Check for 'zoom' event listener (should be 0 in auto mode effect, 1 for UI updates)
  const zoomListeners = (projTransContent.match(/\.on\s*\(\s*['"]zoom['"]/g) || []).length;
  if (zoomListeners !== 1) {
    WARNINGS.push(
      `⚠️  useProjectionTransition.ts: Expected 1 'zoom' listener (for UI), found ${zoomListeners}`
    );
  }

  // Check for 'zoomend' event listener (should be exactly 1)
  const zoomendListeners = (projTransContent.match(/\.on\s*\(\s*['"]zoomend['"]/g) || []).length;
  if (zoomendListeners !== 1) {
    ERRORS.push(
      `❌ useProjectionTransition.ts: Expected 1 'zoomend' listener, found ${zoomendListeners}`
    );
  }

  // Check for easeTo calls (should be 0)
  const easeToCallsInApply = (projTransContent.match(/map\.current\.easeTo\s*\(/g) || []).length;
  if (easeToCallsInApply > 0) {
    ERRORS.push(
      `❌ useProjectionTransition.ts: Found ${easeToCallsInApply} easeTo calls (should be 0)`
    );
  }

  // Check for triggerRepaint (should be 0)
  const triggerRepaints = (projTransContent.match(/triggerRepaint\s*\(/g) || []).length;
  if (triggerRepaints > 0) {
    ERRORS.push(
      `❌ useProjectionTransition.ts: Found ${triggerRepaints} triggerRepaint calls (should be 0)`
    );
  }

  // Check for setMaxBounds calls (should be 0)
  const maxBoundsCalls = (projTransContent.match(/setMaxBounds\s*\(/g) || []).length;
  if (maxBoundsCalls > 0) {
    WARNINGS.push(
      `⚠️  useProjectionTransition.ts: Found ${maxBoundsCalls} setMaxBounds calls (not recommended)`
    );
  }
}

// Results
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

if (WARNINGS.length > 0) {
  console.log("⚠️  WARNINGS:\n");
  WARNINGS.forEach((warn) => console.log(warn));
  console.log("");
}

if (ERRORS.length === 0) {
  console.log("✅ Projection system validation PASSED\n");
  console.log("   ✓ Only useProjectionTransition handles projections");
  console.log("   ✓ No duplicate setProjection calls");
  console.log("   ✓ No duplicate setFog calls");
  console.log("   ✓ No conflicting event listeners");
  console.log("   ✓ No camera animations during transitions");
  console.log("   ✓ Clean separation of concerns\n");
  process.exit(0);
} else {
  console.log("❌ Projection system validation FAILED\n");
  ERRORS.forEach((err) => console.log(err));
  console.log("");
  process.exit(1);
}
