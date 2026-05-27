import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });

const routerFile = "src/server/api/routers/diplomatic.ts";
const outDir = "src/server/api/routers/diplomacy";

fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  core: [
    "getRelationships",
    "getRecentChanges",
    "updateRelationship",
    "createRelationship",
    "deleteRelationship",
    "getInfluenceBreakdown",
    "updateRelationshipStrength",
    "getInfluenceLeaderboard",
    "getFollowStatus",
    "followCountry",
    "unfollowCountry",
    "getSharedData",
    "shareData",
    "revokeSharedData",
    "getDiplomaticOptions",
    "getAllDiplomaticOptions",
    "getOptionUsageStats",
  ],
  embassies: [
    "getEmbassies",
    "establishEmbassy",
    "getEmbassyDetails",
    "calculateEstablishmentCost",
    "upgradeEmbassy",
    "getAvailableUpgrades",
    "getAvailableMissions",
    "startMission",
    "completeMission",
    "payMaintenance",
    "allocateBudget",
    "updateEmbassyProfile",
    "closeEmbassy",
    "getActiveMissions",
  ],
  cultural: [
    "getCulturalExchanges",
    "createCulturalExchange",
    "joinCulturalExchange",
    "linkExchangeToMission",
    "voteOnExchange",
    "uploadCulturalArtifact",
    "generateCulturalScenario",
    "getNPCCulturalResponse",
    "calculateExchangeImpact",
    "getCulturalCompatibility",
    "getRecommendedPartners",
    "updateCulturalExchange",
    "cancelCulturalExchange",
    "getNPCCulturalResponses",
  ],
  policies: [
    "getActiveForeignPolicies",
    "getBilateralTrade",
    "previewForeignPolicyImpact",
    "proposeForeignPolicyAction",
    "liftForeignPolicyAction",
    "getAlliances",
    "getAllianceDashboard",
    "createAlliance",
    "inviteMember",
    "leaveAlliance",
    "proposeAllianceAction",
    "voteOnAllianceAction",
    "createAllianceDocument",
    "getAllianceDocuments",
  ],
};

async function processRouter() {
  const originalFile = project.getSourceFileOrThrow(routerFile);

  for (const [groupName, endpointNames] of Object.entries(groups)) {
    const outPath = `${outDir}/${groupName}.ts`;
    console.log(`Generating ${outPath}...`);

    fs.copyFileSync(routerFile, outPath);
    const sourceFile = project.addSourceFileAtPath(outPath);

    const routerDecl = sourceFile.getVariableDeclarationOrThrow("diplomaticRouter");
    routerDecl.rename(`diplomatic${groupName.charAt(0).toUpperCase() + groupName.slice(1)}Router`);

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
