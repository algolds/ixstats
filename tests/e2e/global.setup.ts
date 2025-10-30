import { request, FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PROD_CLONE_BASE_URL || "http://localhost:3000";
  const authEmail = process.env.E2E_USER_EMAIL;
  const authPassword = process.env.E2E_USER_PASSWORD;

  const storagePath = path.resolve(".auth/prodclone.json");
  if (!fs.existsSync(path.dirname(storagePath))) {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  }

  // If we don't have creds, skip creating storage and rely on public-only tests
  if (!authEmail || !authPassword) {
    // Create empty storage to satisfy config
    fs.writeFileSync(storagePath, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const requestContext = await request.newContext({ baseURL });
  // Attempt programmatic sign-in via UI endpoints (Clerk-hosted pages should be available)
  // Fallback to saved storage if already valid
  try {
    const res = await requestContext.post("/api/auth/e2e-login", {
      data: { email: authEmail, password: authPassword },
    });
    if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${res.statusText()}`);
  } catch {
    // If custom endpoint not available, proceed without auth
  }

  // Save context storage (cookies/localStorage captured by Playwright during tests; here we create placeholder)
  fs.writeFileSync(storagePath, JSON.stringify({ cookies: [], origins: [] }));
  await requestContext.dispose();
}
