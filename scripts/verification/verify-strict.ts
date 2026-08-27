import { spawnSync } from "node:child_process";

export interface VerificationStage {
  name: string;
  command: string;
  args: string[];
}

export const DEFAULT_STRICT_STAGES: VerificationStage[] = [
  { name: "Typecheck (UI)", command: "bun", args: ["run", "typecheck:ui"] },
  { name: "Typecheck (Server)", command: "bun", args: ["run", "typecheck:server"] },
  { name: "Typecheck (tRPC)", command: "bun", args: ["run", "typecheck:trpc"] },
  { name: "Lint (Strict)", command: "bun", args: ["run", "lint:strict"] },
  { name: "Architecture Guard", command: "bun", args: ["run", "audit:arch"] },
];

export interface RunStagesResult {
  passed: boolean;
  failedStage?: string;
  exitCode: number;
  completedStages: string[];
}

export function runStrictStages(
  stages: VerificationStage[] = DEFAULT_STRICT_STAGES
): RunStagesResult {
  console.log(`\n🔍 Running strict sequential verification (${stages.length} stages)...\n`);
  const completedStages: string[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    console.log(
      `▶ [${i + 1}/${stages.length}] ${stage.name} (${stage.command} ${stage.args.join(" ")})`
    );

    const result = spawnSync(stage.command, stage.args, {
      stdio: "inherit",
      env: process.env,
    });

    if (result.error) {
      console.error(`\n❌ Stage "${stage.name}" failed to spawn:`, result.error.message);
      return {
        passed: false,
        failedStage: stage.name,
        exitCode: 1,
        completedStages,
      };
    }

    const exitCode = result.status ?? (result.signal ? 1 : 0);
    if (exitCode !== 0) {
      console.error(
        `\n❌ Stage "${stage.name}" failed with exit code ${exitCode}. Short-circuiting verification.`
      );
      return {
        passed: false,
        failedStage: stage.name,
        exitCode,
        completedStages,
      };
    }

    console.log(`✔ [${i + 1}/${stages.length}] ${stage.name} passed.\n`);
    completedStages.push(stage.name);
  }

  console.log(`\n🎉 All ${stages.length} verification stages passed successfully!\n`);
  return {
    passed: true,
    exitCode: 0,
    completedStages,
  };
}

if (import.meta.main || process.argv[1]?.endsWith("verify-strict.ts")) {
  const result = runStrictStages();
  process.exit(result.exitCode);
}
