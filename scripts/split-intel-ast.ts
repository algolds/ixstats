import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });

const routerFile = "src/server/api/routers/unified-intelligence.ts";
const outDir = "src/server/api/routers/intelligence";

fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  core: [
    "getOverview", "getQuickActions", "executeAction", "getDiplomaticChannels",
    "sendSecureMessage", "getIntelligenceFeed", "getCabinetMeetings",
    "createCabinetMeeting", "getEnhancedDiplomaticIntelligence", "getStrategicPlans",
    "getKeyFindings"
  ],
  alerts: [
    "acknowledgeAlert", "archiveAlert", "getAlertThresholds", "updateAlertThreshold",
    "deleteAlertThreshold", "getActiveCrises", "getCrisisEvents", "getResponseTeams",
    "getSecurityThreats", "getSecurityDashboard", "createSecurityThreat"
  ],
  analytics: [
    "getAnalytics", "getAdvancedAnalytics", "getAIRecommendations",
    "getPredictiveModels", "getRealTimeMetrics", "createBriefing",
    "getEconomicPolicies", "createEconomicPolicy", "implementEconomicPolicy",
    "getPolicyEffectiveness", "getEconomicIndicators", "getCommodityPrices"
  ]
};

async function processRouter() {
  const originalFile = project.getSourceFileOrThrow(routerFile);

  for (const [groupName, endpointNames] of Object.entries(groups)) {
    const outPath = `${outDir}/${groupName}.ts`;
    console.log(`Generating ${outPath}...`);
    
    fs.copyFileSync(routerFile, outPath);
    const sourceFile = project.addSourceFileAtPath(outPath);
    
    const routerDecl = sourceFile.getVariableDeclarationOrThrow("unifiedIntelligenceRouter");
    routerDecl.rename(`intel${groupName.charAt(0).toUpperCase() + groupName.slice(1)}Router`);
    
    const callExpr = routerDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
    const objExpr = callExpr.getArguments()[0] as ObjectLiteralExpression;
    
    const properties = objExpr.getProperties().filter(p => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];
    
    for (const prop of properties) {
      if (!endpointNames.includes(prop.getName())) {
        prop.remove();
      }
    }
    
    await sourceFile.save();
  }
}

processRouter().then(() => console.log("Done")).catch(console.error);
