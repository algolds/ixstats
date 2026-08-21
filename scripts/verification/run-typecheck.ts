import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function parseTypecheckArgs(args: string[]): {
  projectPath: string | null;
  logPath: string | null;
  extraArgs: string[];
} {
  let projectPath: string | null = null;
  let logPath: string | null = null;
  const extraArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--log") {
      if (i + 1 < args.length) {
        logPath = args[++i];
      }
    } else if (arg.startsWith("--log=")) {
      logPath = arg.slice("--log=".length);
    } else if (arg === "-p" || arg === "--project") {
      if (i + 1 < args.length) {
        projectPath = args[++i];
      }
    } else if (arg.startsWith("-p=") || arg.startsWith("--project=")) {
      projectPath = arg.split("=")[1] ?? null;
    } else if (!arg.startsWith("-") && arg.endsWith(".json")) {
      projectPath = arg;
    } else {
      extraArgs.push(arg);
    }
  }

  return { projectPath, logPath, extraArgs };
}

export function runTypecheck(
  args: string[],
  onExit?: (code: number) => void
): void {
  const { projectPath, logPath, extraArgs } = parseTypecheckArgs(args);

  if (!projectPath) {
    console.error(
      "Error: Missing project tsconfig path. Usage: bun scripts/verification/run-typecheck.ts <tsconfig.json> [--log <logPath>]"
    );
    if (onExit) {
      onExit(1);
      return;
    }
    process.exit(1);
  }

  const resolvedProjectPath = path.resolve(process.cwd(), projectPath);
  if (!fs.existsSync(resolvedProjectPath)) {
    console.error(`Error: Project tsconfig not found: ${projectPath}`);
    if (onExit) {
      onExit(1);
      return;
    }
    process.exit(1);
  }

  let logStream: fs.WriteStream | null = null;
  if (logPath) {
    const resolvedLogPath = path.resolve(process.cwd(), logPath);
    fs.mkdirSync(path.dirname(resolvedLogPath), { recursive: true });
    logStream = fs.createWriteStream(resolvedLogPath, { flags: "w" });
  }

  const tscArgs = ["-p", projectPath, "--noEmit", ...extraArgs];
  const tscBin = path.resolve(process.cwd(), "node_modules/.bin/tsc");
  const command = fs.existsSync(tscBin) ? tscBin : "tsc";

  const child = spawn(command, tscArgs, {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    logStream?.write(chunk);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
    logStream?.write(chunk);
  });

  child.on("error", (err) => {
    console.error(`Failed to start tsc: ${err.message}`);
    logStream?.end();
    if (onExit) {
      onExit(1);
      return;
    }
    process.exit(1);
  });

  child.on("close", (code, signal) => {
    logStream?.end();
    const finalCode = signal ? 1 : code ?? 0;
    if (onExit) {
      onExit(finalCode);
      return;
    }
    process.exit(finalCode);
  });
}

if (import.meta.main || process.argv[1]?.endsWith("run-typecheck.ts")) {
  runTypecheck(process.argv.slice(2));
}
