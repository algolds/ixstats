import * as fs from "fs";
import * as path from "path";

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

function walk(dir: string, callback: (filepath: string) => void) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        walk(filepath, callback);
      }
    } else {
      if (filepath.endsWith(".ts") || filepath.endsWith(".tsx")) {
        callback(filepath);
      }
    }
  }
}

let changedFiles = 0;
let replacements = 0;

walk("src", (filepath) => {
  let content = fs.readFileSync(filepath, "utf8");
  let modified = false;

  for (const [subRouter, endpoints] of Object.entries(groups)) {
    for (const ep of endpoints) {
      // We want to replace `.geo.endpointName` with `.subrouter.endpointName`
      // This handles `api.geo.getWorldMap` and `utils.geo.getWorldMap` and `trpc.geo.getWorldMap`
      const regex = new RegExp(`\\.geo\\.${ep}\\b`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, `.${subRouter}.${ep}`);
        modified = true;
        replacements++;
      }
      
      // Also handle router invalidation patterns: `utils.geo.invalidate()` -> `utils.geoCore.invalidate()`
      // Actually we can't easily do this automatically if it's just `.geo.invalidate()` without endpoint.
      // We'll leave `.geo.invalidate()` to be fixed manually or via compiler errors, as it's rare.
    }
  }

  if (modified) {
    fs.writeFileSync(filepath, content, "utf8");
    changedFiles++;
    console.log(`Updated ${filepath}`);
  }
});

console.log(`Done! Made ${replacements} replacements across ${changedFiles} files.`);
