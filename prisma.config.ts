import { defineConfig } from "@prisma/config";
import fs from "node:fs";
import path from "node:path";

// Automatically load development environment variables if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const envFiles = [".env.local.dev", ".env.local", ".env"];
  for (const envFile of envFiles) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1]?.trim();
          let val = match[2]?.trim() || "";
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

export default defineConfig({
  schema: "prisma/schema",
});
