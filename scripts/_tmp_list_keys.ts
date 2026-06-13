import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
const project = new Project({ skipAddingFilesFromTsConfig: true });
const sf = project.addSourceFileAtPath("/tmp/cultural_orig.ts");
const decl = sf.getVariableDeclarationOrThrow("diplomaticCulturalRouter");
const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const obj = call.getArguments()[0] as ObjectLiteralExpression;
const props = (obj.getProperties().filter(p => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]).map(p => p.getName());
console.log("COUNT:", props.length);
props.forEach((p,i) => console.log(`${i+1}. ${p}`));
