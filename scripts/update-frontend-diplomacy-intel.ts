import * as fs from "fs";
import * as path from "path";

const dipGroups: Record<string, string[]> = {
  diplomaticCore: [
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
  diplomaticEmbassies: [
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
  diplomaticCultural: [
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
  diplomaticPolicies: [
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

const intelGroups: Record<string, string[]> = {
  intelCore: [
    "getOverview",
    "getQuickActions",
    "executeAction",
    "getDiplomaticChannels",
    "sendSecureMessage",
    "getIntelligenceFeed",
    "getCabinetMeetings",
    "createCabinetMeeting",
    "getEnhancedDiplomaticIntelligence",
    "getStrategicPlans",
    "getKeyFindings",
  ],
  intelAlerts: [
    "acknowledgeAlert",
    "archiveAlert",
    "getAlertThresholds",
    "updateAlertThreshold",
    "deleteAlertThreshold",
    "getActiveCrises",
    "getCrisisEvents",
    "getResponseTeams",
    "getSecurityThreats",
    "getSecurityDashboard",
    "createSecurityThreat",
  ],
  intelAnalytics: [
    "getAnalytics",
    "getAdvancedAnalytics",
    "getAIRecommendations",
    "getPredictiveModels",
    "getRealTimeMetrics",
    "createBriefing",
    "getEconomicPolicies",
    "createEconomicPolicy",
    "implementEconomicPolicy",
    "getPolicyEffectiveness",
    "getEconomicIndicators",
    "getCommodityPrices",
  ],
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

  for (const [subRouter, endpoints] of Object.entries(dipGroups)) {
    for (const ep of endpoints) {
      const regex = new RegExp(`\\.diplomatic\\.${ep}\\b`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, `.${subRouter}.${ep}`);
        modified = true;
        replacements++;
      }
    }
  }

  for (const [subRouter, endpoints] of Object.entries(intelGroups)) {
    for (const ep of endpoints) {
      const regex = new RegExp(`\\.unifiedIntelligence\\.${ep}\\b`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, `.${subRouter}.${ep}`);
        modified = true;
        replacements++;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filepath, content, "utf8");
    changedFiles++;
    console.log(`Updated ${filepath}`);
  }
});

console.log(`Done! Made ${replacements} replacements across ${changedFiles} files.`);
