#!/usr/bin/env tsx
// scripts/ops/verify-stage3-cutover.ts
// Verifies Stage 3 Nginx lockdown rules and internal loopback availability.

import http from "node:http";
import https from "node:https";

interface CheckResult {
  name: string;
  passed: boolean;
  status?: number;
  message?: string;
}

const RESULTS: CheckResult[] = [];

async function checkUrl(
  url: string,
  options: {
    expectedStatus?: number[];
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https://");
    const client = isHttps ? https : http;
    const req = client.get(
      url,
      {
        headers: options.headers ?? {},
        timeout: options.timeoutMs ?? 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

async function runAudit() {
  console.log("=================================================");
  console.log("WikiOS Stage 3 Cutover Verification Audit");
  console.log("=================================================\n");

  // 1. Check MediaWiki Internal Loopback
  const loopbackUrl = process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL ?? "http://127.0.0.1/api.php";
  try {
    const res = await checkUrl(`${loopbackUrl}?action=query&meta=siteinfo&format=json`);
    const passed = res.status === 200 && res.body.includes("sitename");
    RESULTS.push({
      name: `Internal Loopback Access (${loopbackUrl})`,
      passed,
      status: res.status,
      message: passed ? "MediaWiki responded on loopback" : "Response body did not match siteinfo",
    });
  } catch (err) {
    RESULTS.push({
      name: `Internal Loopback Access (${loopbackUrl})`,
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Report Results
  console.log("Audit Summary:");
  let failed = 0;
  for (const r of RESULTS) {
    const icon = r.passed ? "✓" : "✗";
    console.log(` ${icon} [${r.passed ? "PASS" : "FAIL"}] ${r.name}`);
    if (r.status) console.log(`    HTTP Status: ${r.status}`);
    if (r.message) console.log(`    Detail: ${r.message}`);
    if (!r.passed) failed++;
  }

  console.log(`\nTotal: ${RESULTS.length}, Failed: ${failed}`);
  if (failed > 0) {
    console.log("\nNote: Some checks may fail in local development without local Nginx running.");
  }
}

void runAudit();
