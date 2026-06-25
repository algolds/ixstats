import fs from "fs";
import path from "path";

export interface NationalIssuesConfig {
  maxIssuesPerSession: number;
  maxIssuesPerWeek: number;
}

const CONFIG_PATH = path.join(process.cwd(), "data", "national-issues-config.json");
const DEFAULT_CONFIG: NationalIssuesConfig = {
  maxIssuesPerSession: 3,
  maxIssuesPerWeek: 5,
};

export function getNationalIssuesConfig(): NationalIssuesConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Ensure parent directory exists
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
      return DEFAULT_CONFIG;
    }
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return {
      maxIssuesPerSession:
        typeof parsed.maxIssuesPerSession === "number"
          ? parsed.maxIssuesPerSession
          : DEFAULT_CONFIG.maxIssuesPerSession,
      maxIssuesPerWeek:
        typeof parsed.maxIssuesPerWeek === "number"
          ? parsed.maxIssuesPerWeek
          : DEFAULT_CONFIG.maxIssuesPerWeek,
    };
  } catch (err) {
    console.error("[NationalIssuesConfig] Failed to read config, returning default:", err);
    return DEFAULT_CONFIG;
  }
}

export function saveNationalIssuesConfig(config: NationalIssuesConfig): void {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[NationalIssuesConfig] Failed to write config:", err);
    throw new Error("Failed to save national issues configuration");
  }
}
