import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });

const routerFile = "src/server/api/routers/geo.ts";
const outDir = "src/server/api/routers/geo";

fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  core: [
    "getWorldMap",
    "getMapBundle",
    "getCountryGeometry",
    "getCountryAtPoint",
    "getPointInfo",
    "listCountries",
    "getLayerInfo",
    "searchFeatures",
    "getNeighbors",
    "getCountryFeatures",
    "getMapStats",
    "getSystemHealth",
    "validatePointInCountry",
    "getNeighborGeometries",
    "recalculateArea",
    "recalculateAllAreas",
    "getAllMapFeatures",
    "getCapitalCities",
    "getCountryConflicts",
    "getCountryLinkage",
    "getSharedVertices",
    "getRegionalChoropleth",
    "getCrisisRiskMap",
    "getTradeRouteGeoJSON",
    "getGeopoliticalOverlay",
    "getCountryGeoProfile",
    "recalculateGeoProfiles",
  ],
  features: [
    "createCity",
    "updateCity",
    "deleteCity",
    "createSubdivision",
    "updateSubdivision",
    "deleteSubdivision",
    "simplifySubdivisions",
    "getSubdivisionStats",
    "deleteAllSubdivisions",
    "createPOI",
    "updatePOI",
    "deletePOI",
    "createStoryPin",
    "updateStoryPin",
    "deleteStoryPin",
    "getStoryPin",
    "getStoryPinFull",
    "getStoryPinsByCountry",
    "getAllStoryPins",
    "createStoryline",
    "updateStoryline",
    "deleteStoryline",
    "getStorylinesByCountry",
    "getStorylineWithPins",
    "createMapLabel",
    "updateMapLabel",
    "deleteMapLabel",
    "getMapLabelsByCountry",
    "getAllMapLabels",
  ],
  editor: [
    "assignCountryGeometry",
    "unlinkCountryGeometry",
    "autoLinkAllCountries",
    "getEditQueue",
    "approveEdit",
    "rejectEdit",
    "startBorderEditSession",
    "saveBorderEditDraft",
    "submitBorderEdit",
    "splitCountry",
    "mergeCountries",
    "getMyEditHistory",
    "validateLinkage",
    "repairLinkage",
    "generateProceduralWorld",
    "getProceduralWorldPreview",
    "commitProceduralWorld",
    "regenerateLayer",
    "listProceduralWorlds",
    "runPipeline",
    "importPipelineResult",
  ],
  admin: [
    "uploadSvg",
    "processSvgUpload",
    "previewSvgUpload",
    "commitSvgUpload",
    "rollbackSvgUpload",
    "getSvgUploadHistory",
    "deleteSvgUpload",
    "exportWorldTemplate",
    "downloadWorldTemplate",
    "importWorldTemplate",
    "listWorldTemplates",
    "deleteWorldTemplate",
    "parseProvinceUpload",
    "validateProvinceImport",
    "commitProvinceImport",
    "getProvinceImportPreview",
  ],
  sovereignty: [
    "getSovereigntyRelations",
    "getCountrySovereignty",
    "createSovereignty",
    "updateSovereignty",
    "deleteSovereignty",
  ],
  wiki: ["getFeatureWikiIntro", "parseWikiInfobox", "searchWikiPages", "scanWikiForPlaces"],
};

async function processRouter() {
  const originalFile = project.getSourceFileOrThrow(routerFile);

  for (const [groupName, endpointNames] of Object.entries(groups)) {
    const outPath = `${outDir}/${groupName}.ts`;
    console.log(`Generating ${outPath}...`);

    fs.copyFileSync(routerFile, outPath);
    const sourceFile = project.addSourceFileAtPath(outPath);

    const routerDecl = sourceFile.getVariableDeclarationOrThrow("geoRouter");
    routerDecl.rename(`geo${groupName.charAt(0).toUpperCase() + groupName.slice(1)}Router`);

    const callExpr = routerDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
    const objExpr = callExpr.getArguments()[0] as ObjectLiteralExpression;

    const properties = objExpr
      .getProperties()
      .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

    for (const prop of properties) {
      if (!endpointNames.includes(prop.getName())) {
        prop.remove();
      }
    }

    await sourceFile.save();
  }
}

processRouter()
  .then(() => console.log("Done"))
  .catch(console.error);
