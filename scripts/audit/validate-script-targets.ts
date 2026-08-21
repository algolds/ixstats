/**
 * Static script target validator for Plan 168.
 *
 * Validates that all scripts in package.json and workflow definitions:
 * 1. Reference files/configs that actually exist on disk.
 * 2. Do NOT use banned package managers (npm, npx, yarn, pnpm, pnpx).
 * 3. Have matching scripts in package.json when called via `bun run <script>` in CI.
 *
 * Never executes commands. Pure static analysis only.
 */

import * as fs from "fs";
import * as path from "path";

export const DEFAULT_ROOT = process.cwd();

export const BANNED_PACKAGE_MANAGERS = ["npm", "npx", "yarn", "pnpm", "pnpx"] as const;

export interface ValidationIssue {
  source: string;
  field?: string;
  command?: string;
  message: string;
  type: "missing_target" | "banned_manager" | "unknown_script" | "missing_config";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Checks for banned package manager tokens in a command string.
 */
export function checkBannedPackageManagers(
  command: string,
  source: string,
  field?: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tokens = command.split(/\s+|&&|\|\||;/);

  for (const token of tokens) {
    const clean = token.trim();
    if ((BANNED_PACKAGE_MANAGERS as readonly string[]).includes(clean)) {
      issues.push({
        source,
        field,
        command,
        type: "banned_manager",
        message: `Banned package manager token '${clean}' used in '${source}${field ? ` -> ${field}` : ""}'. Use bun/bunx instead.`,
      });
    }
  }

  return issues;
}

/**
 * Extracts and checks path targets from a command (e.g. ./scripts/..., -p tsconfig.xyz.json).
 */
export function checkCommandTargets(
  command: string,
  source: string,
  field: string,
  rootDir: string = DEFAULT_ROOT
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Match direct file paths like ./scripts/foo.sh or scripts/foo.ts
  const scriptRegex = /(?:^|\s)(?:\.\/|\.\.\/)?(scripts\/[^\s;&|]+|start-[^\s;&|]+|prisma\/[^\s;&|]+)/g;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(command)) !== null) {
    const rawPath = match[1];
    if (rawPath) {
      // Remove any trailing flags or arguments
      const cleanPath = rawPath.replace(/[;&|].*$/, "").trim();
      const targetAbs = path.join(rootDir, cleanPath);
      if (!fs.existsSync(targetAbs)) {
        issues.push({
          source,
          field,
          command,
          type: "missing_target",
          message: `Target file '${cleanPath}' referenced in '${field}' does not exist on disk.`,
        });
      }
    }
  }

  // Match tsconfig paths like -p tsconfig.xyz.json or --project tsconfig.xyz.json
  const tsconfigRegex = /(?:-p|--project)\s+([^\s;&|]+\.json)/g;
  while ((match = tsconfigRegex.exec(command)) !== null) {
    const configPath = match[1];
    if (configPath) {
      const targetAbs = path.join(rootDir, configPath);
      if (!fs.existsSync(targetAbs)) {
        issues.push({
          source,
          field,
          command,
          type: "missing_config",
          message: `TypeScript config '${configPath}' referenced in '${field}' does not exist on disk.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validates package.json scripts.
 */
export function validatePackageJsonScripts(
  packageJsonPath: string,
  rootDir: string = DEFAULT_ROOT
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(packageJsonPath)) {
    return [
      {
        source: packageJsonPath,
        type: "missing_target",
        message: `package.json not found at ${packageJsonPath}`,
      },
    ];
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const scripts: Record<string, string> = pkg.scripts || {};

  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    // 1. Check banned tokens
    issues.push(...checkBannedPackageManagers(scriptCmd, "package.json", scriptName));

    // 2. Check target paths
    issues.push(...checkCommandTargets(scriptCmd, "package.json", scriptName, rootDir));
  }

  return issues;
}

/**
 * Validates workflow YAML files for valid `bun run <script>` references and banned managers.
 */
export function validateWorkflowFiles(
  workflowsDir: string,
  validScriptNames: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(workflowsDir)) {
    return issues;
  }

  const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;
      const source = `.github/workflows/${file}:${lineNum}`;

      // Check banned package managers in run: steps
      if (line.includes("run:")) {
        issues.push(...checkBannedPackageManagers(line, source));

        // Check bun run <script>
        const bunRunMatch = line.match(/bun\s+run\s+([a-zA-Z0-9_:-]+)/);
        if (bunRunMatch && bunRunMatch[1]) {
          const scriptName = bunRunMatch[1];
          // Exclude built-in flags or file targets
          if (!scriptName.startsWith("-") && !scriptName.includes("/") && !scriptName.includes(".")) {
            if (!validScriptNames.has(scriptName)) {
              issues.push({
                source,
                command: line.trim(),
                type: "unknown_script",
                message: `Workflow references 'bun run ${scriptName}', but '${scriptName}' is not defined in package.json scripts.`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Full static validator runner.
 */
export function validateScriptTargets(rootDir: string = DEFAULT_ROOT): ValidationResult {
  const packageJsonPath = path.join(rootDir, "package.json");
  const workflowsDir = path.join(rootDir, ".github", "workflows");

  const issues: ValidationIssue[] = [];

  // 1. Validate package.json scripts
  issues.push(...validatePackageJsonScripts(packageJsonPath, rootDir));

  // Extract valid script names from package.json
  let validScriptNames = new Set<string>();
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      validScriptNames = new Set(Object.keys(pkg.scripts || {}));
    } catch {
      // Ignored
    }
  }

  // 2. Validate workflows
  issues.push(...validateWorkflowFiles(workflowsDir, validScriptNames));

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────

export function runCLI(): void {
  const result = validateScriptTargets(DEFAULT_ROOT);

  if (result.valid) {
    console.log("✓ Script target validation passed: 0 missing targets, 0 banned managers, 0 dead workflow references.");
    process.exit(0);
  }

  console.error(`✗ Script target validation failed with ${result.issues.length} issue(s):\n`);
  for (const issue of result.issues) {
    console.error(`  • [${issue.type}] ${issue.message}`);
  }
  process.exit(1);
}

const isMain =
  Boolean(import.meta.main) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  Boolean(process.argv[1]?.endsWith("validate-script-targets.ts"));

if (isMain) {
  runCLI();
}
