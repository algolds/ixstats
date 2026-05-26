import { Project } from "ts-morph";
const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });

const files = [
  "src/server/api/routers/intelligence/core.ts",
  "src/server/api/routers/intelligence/alerts.ts",
  "src/server/api/routers/intelligence/analytics.ts"
];

const schemaNames = [
  "classificationSchema",
  "prioritySchema",
  "actionTypeSchema",
  "cabinetMeetingSchema",
  "quickActionSchema",
  "diplomaticMessageSchema",
  "securityThreatSchema",
  "strategicPlanSchema",
  "economicPolicySchema"
];

for (const file of files) {
  const sourceFile = project.getSourceFileOrThrow(file);
  
  for (const name of schemaNames) {
    const decl = sourceFile.getVariableStatement(s => s.getDeclarations().some(d => d.getName() === name));
    if (decl) {
      decl.remove();
    }
  }
  
  // Add import
  sourceFile.addImportDeclaration({
    moduleSpecifier: "../schemas/intelligence",
    namedImports: schemaNames
  });
  
  sourceFile.saveSync();
  console.log(`Cleaned schemas from ${file}`);
}
