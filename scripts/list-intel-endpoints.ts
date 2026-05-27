import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
const project = new Project({ tsConfigFilePath: "tsconfig.server.min.json" });
const sourceFile = project.getSourceFileOrThrow("src/server/api/routers/unified-intelligence.ts");
const routerDecl = sourceFile.getVariableDeclarationOrThrow("unifiedIntelligenceRouter");
const callExpr = routerDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const objExpr = callExpr.getArguments()[0] as ObjectLiteralExpression;
const endpoints = objExpr
  .getProperties()
  .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];
console.log(endpoints.map((p) => p.getName()).join(", "));
