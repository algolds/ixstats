/**
 * Country IDOR audit (Plan 332).
 *
 * Every tRPC mutation that writes country-owned data must check that the caller
 * may write to that country (`assertCountryWriteAccess` /
 * `assertCountryResourceWriteAccess` from src/server/shared/country-authorization.ts).
 *
 * A mutation is "country-scoped" when its `.input(...)` mentions `countryId`, or
 * when its input has an id key and its body writes to a model in
 * COUNTRY_OWNED_MODELS. Each country-scoped mutation is classified:
 *   OK       — calls one of the assertion helpers
 *   MANUAL   — has an inline check ("FORBIDDEN" or ctx.country); a human must confirm
 *   MISSING  — no check at all
 *   ALLOWED  — listed in scripts/audit/idor-allowlist.json with a justification
 *
 * Usage:
 *   bun scripts/audit/audit-country-idor.ts          # table, exit 1 on MISSING / unlisted MANUAL
 *   bun scripts/audit/audit-country-idor.ts --json   # same result as JSON
 */
import * as fs from "fs";
import * as path from "path";
import { Node, Project, SyntaxKind, type CallExpression } from "ts-morph";

export const ROUTERS_DIR = "src/server/api/routers";
export const ALLOWLIST_PATH = "scripts/audit/idor-allowlist.json";

/** Prisma delegates whose rows belong to a country. */
export const COUNTRY_OWNED_MODELS = [
  "governmentStructure",
  "governmentComponent",
  "governmentDepartment",
  "governmentOfficial",
  "cabinetMeeting",
  "meetingAgendaItem",
  "meetingDecision",
  "meetingActionItem",
  "meetingAttendance",
  "policy",
  "activitySchedule",
  "storytellerEffect",
  "crossBuilderSynergy",
  "country",
] as const;

/** Procedure builders that do not bind the caller to the target country. */
export const AUDITED_ROOTS = new Set<string>([
  "publicProcedure",
  "protectedProcedure",
  "lightMutationProcedure",
  "readOnlyProcedure",
  "premiumProcedure",
  "cachedProtectedProcedure",
  "rateLimitedPublicProcedure",
  "countryOwnerProcedure",
  "standardMutationCountryOwnerProcedure",
]);

const WRITE_METHODS = "create|update|upsert|delete|deleteMany|updateMany|createMany";
const OWNED_WRITE_RE = new RegExp(`\\.(${COUNTRY_OWNED_MODELS.join("|")})\\.(${WRITE_METHODS})\\(`);
const COUNTRY_ID_RE = /\bcountryId\b/;
const ID_KEY_RE = /\b(id|[A-Za-z]+Id)\s*:/;
const ASSERT_RE = /\b(assertCountryWriteAccess|assertCountryResourceWriteAccess)\(/;
const INLINE_CHECK_RE = /"FORBIDDEN"|\bctx\.country\b/;

export type IdorStatus = "MISSING" | "MANUAL" | "ALLOWED" | "OK";

export interface IdorFinding {
  status: IdorStatus;
  file: string;
  line: number;
  procedure: string;
  root: string;
  justification?: string;
}

interface MutationChain {
  root: string;
  inputText: string;
  bodyText: string;
}

/** Walk a `.mutation(...)` builder chain down to its root identifier. */
function readChain(mutationCall: CallExpression): MutationChain | null {
  const inputs: string[] = [];
  let node: Node = mutationCall.getExpression();
  while (!Node.isIdentifier(node)) {
    if (Node.isPropertyAccessExpression(node)) {
      node = node.getExpression();
    } else if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      if (Node.isPropertyAccessExpression(callee) && callee.getName() === "input") {
        inputs.push(
          node
            .getArguments()
            .map((a) => resolveInputText(a))
            .join(",")
        );
      }
      node = callee;
    } else {
      return null;
    }
  }
  const bodyText = mutationCall
    .getArguments()
    .map((a) => a.getText())
    .join(",");
  return { root: node.getText(), inputText: inputs.join(","), bodyText };
}

/** Inline a same-file schema variable so `.input(schema)` is classified by its shape. */
function resolveInputText(arg: Node): string {
  if (!Node.isIdentifier(arg)) return arg.getText();
  const decl = arg
    .getSymbol()
    ?.getDeclarations()
    .find((d) => Node.isVariableDeclaration(d));
  const init = decl && Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined;
  return init ? init.getText() : arg.getText();
}

function procedureName(mutationCall: CallExpression): string {
  const prop = mutationCall.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
  return prop ? prop.getName() : "<anonymous>";
}

export function isCountryScoped(inputText: string, bodyText: string): boolean {
  if (COUNTRY_ID_RE.test(inputText)) return true;
  return ID_KEY_RE.test(inputText) && OWNED_WRITE_RE.test(bodyText);
}

export function classifyBody(bodyText: string): Exclude<IdorStatus, "ALLOWED"> {
  if (ASSERT_RE.test(bodyText)) return "OK";
  if (INLINE_CHECK_RE.test(bodyText)) return "MANUAL";
  return "MISSING";
}

/** Analyze one router source file; `file` is the repo-relative path used in the report. */
export function analyzeSource(project: Project, file: string, text: string): IdorFinding[] {
  const sourceFile = project.createSourceFile(file, text, { overwrite: true });
  const findings: IdorFinding[] = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "mutation") continue;
    const chain = readChain(call);
    if (!chain || !AUDITED_ROOTS.has(chain.root)) continue;
    if (!isCountryScoped(chain.inputText, chain.bodyText)) continue;
    findings.push({
      status: classifyBody(chain.bodyText),
      file,
      line: call.getStartLineNumber(),
      procedure: procedureName(call),
      root: chain.root,
    });
  }
  return findings;
}

export function applyAllowlist(
  findings: IdorFinding[],
  allowlist: Record<string, string>
): IdorFinding[] {
  return findings.map((f) => {
    const justification = allowlist[`${f.file}#${f.procedure}`];
    if (!justification || f.status === "OK") return f;
    return { ...f, status: "ALLOWED" as const, justification };
  });
}

function listRouterFiles(rootDir: string, relDir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(rootDir, relDir), { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listRouterFiles(rootDir, rel));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(rel);
  }
  return out;
}

function loadAllowlist(rootDir: string): Record<string, string> {
  const abs = path.join(rootDir, ALLOWLIST_PATH);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, string>;
}

const STATUS_ORDER: IdorStatus[] = ["MISSING", "MANUAL", "ALLOWED", "OK"];

export function runAudit(rootDir: string = process.cwd()): IdorFinding[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const findings = listRouterFiles(rootDir, ROUTERS_DIR).flatMap((file) =>
    analyzeSource(project, file, fs.readFileSync(path.join(rootDir, file), "utf8"))
  );
  return applyAllowlist(findings, loadAllowlist(rootDir)).sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  );
}

export function isFailing(findings: IdorFinding[]): boolean {
  return findings.some((f) => f.status === "MISSING" || f.status === "MANUAL");
}

function printTable(findings: IdorFinding[]): void {
  for (const f of findings) {
    const note = f.justification ? `  — ${f.justification}` : "";
    console.log(`${f.status.padEnd(8)}${f.file}:${f.line}  ${f.procedure}  (${f.root})${note}`);
  }
  const counts = STATUS_ORDER.map((s) => `${s}=${findings.filter((f) => f.status === s).length}`);
  console.log(`\n${findings.length} country-scoped mutations: ${counts.join("  ")}`);
}

function runCLI(): void {
  const findings = runAudit();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    printTable(findings);
  }
  process.exit(isFailing(findings) ? 1 : 0);
}

if (import.meta.main) {
  runCLI();
}
