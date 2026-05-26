import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });
const sourceFile = project.getSourceFileOrThrow("src/server/api/routers/geo.ts");

// The router declaration
const routerDecl = sourceFile.getVariableDeclarationOrThrow("geoRouter");
const callExpr = routerDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const objExpr = callExpr.getArguments()[0] as ObjectLiteralExpression;

const endpoints = objExpr.getProperties().filter(p => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

console.log(`Found ${endpoints.length} endpoints in geoRouter.`);

// Create groups
const groups: Record<string, string[]> = {
  geoCore: [
    "getWorldMap", "getMapBundle", "getCountryGeometry", "getCountryAtPoint", "getPointInfo",
    "listCountries", "getLayerInfo", "searchFeatures", "getNeighbors", "getCountryFeatures",
    "getMapStats", "getSystemHealth", "validatePointInCountry", "getNeighborGeometries",
    "recalculateArea", "recalculateAllAreas", "getAllMapFeatures", "getCapitalCities",
    "getCountryConflicts", "getCountryLinkage", "getSharedVertices", "getRegionalChoropleth",
    "getCrisisRiskMap", "getTradeRouteGeoJSON", "getGeopoliticalOverlay", "getCountryGeoProfile",
    "recalculateGeoProfiles"
  ],
  geoFeatures: [
    "createCity", "updateCity", "deleteCity", "createSubdivision", "updateSubdivision",
    "deleteSubdivision", "simplifySubdivisions", "getSubdivisionStats", "deleteAllSubdivisions",
    "createPOI", "updatePOI", "deletePOI", "createStoryPin", "updateStoryPin", "deleteStoryPin",
    "getStoryPin", "getStoryPinFull", "getStoryPinsByCountry", "getAllStoryPins", "createStoryline",
    "updateStoryline", "deleteStoryline", "getStorylinesByCountry", "getStorylineWithPins",
    "createMapLabel", "updateMapLabel", "deleteMapLabel", "getMapLabelsByCountry", "getAllMapLabels"
  ],
  geoEditor: [
    "assignCountryGeometry", "unlinkCountryGeometry", "autoLinkAllCountries", "getEditQueue",
    "approveEdit", "rejectEdit", "startBorderEditSession", "saveBorderEditDraft", "submitBorderEdit",
    "splitCountry", "mergeCountries", "getMyEditHistory", "validateLinkage", "repairLinkage",
    "generateProceduralWorld", "getProceduralWorldPreview", "commitProceduralWorld", "regenerateLayer",
    "listProceduralWorlds", "runPipeline", "importPipelineResult"
  ],
  geoAdmin: [
    "uploadSvg", "processSvgUpload", "previewSvgUpload", "commitSvgUpload", "rollbackSvgUpload",
    "getSvgUploadHistory", "deleteSvgUpload", "exportWorldTemplate", "downloadWorldTemplate",
    "importWorldTemplate", "listWorldTemplates", "deleteWorldTemplate", "parseProvinceUpload",
    "validateProvinceImport", "commitProvinceImport", "getProvinceImportPreview"
  ],
  geoSovereignty: [
    "getSovereigntyRelations", "getCountrySovereignty", "createSovereignty", "updateSovereignty",
    "deleteSovereignty"
  ],
  geoWiki: [
    "getFeatureWikiIntro", "parseWikiInfobox", "searchWikiPages", "scanWikiForPlaces"
  ]
};

// Check if all endpoints are mapped
const mappedEndpoints = new Set<string>();
for (const names of Object.values(groups)) {
  for (const name of names) mappedEndpoints.add(name);
}

const unmapped = endpoints.filter(p => !mappedEndpoints.has(p.getName())).map(p => p.getName());
if (unmapped.length > 0) {
  console.log("Unmapped endpoints:", unmapped);
}

// Generate code
fs.mkdirSync("src/server/api/routers/geo", { recursive: true });

for (const [groupName, endpointNames] of Object.entries(groups)) {
  const groupEndpoints = endpoints.filter(p => endpointNames.includes(p.getName()));
  
  let code = `import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure, systemOwnerProcedure, cachedPublicProcedure, rateLimitedPublicProcedure, countryOwnerProcedure, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";\n`;
  code += `import { z } from "zod";\n`;
  code += `import * as Shared from "./shared";\n\n`;
  code += `export const ${groupName}Router = createTRPCRouter({\n`;
  
  for (const ep of groupEndpoints) {
    // A simple hack to reuse the existing code: replace internal helper calls with Shared. calls
    // But we can't easily know all of them. Let's just output the text first.
    let epText = ep.getText();
    code += `  ${epText},\n`;
  }
  
  code += `});\n`;
  fs.writeFileSync(`src/server/api/routers/geo/${groupName}.ts`, code);
}
console.log("Generated sub-routers.");
