// src/lib/wiki-os/bridge/mysql-pool.ts
// Direct MySQL Connection Pool for IxWiki MariaDB database with circuit breaker.

import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

let ixwikiPool: Pool | null = null;
let mysqlAvailable = true;
let lastFailureTimestamp = 0;
const PROBE_INTERVAL_MS = 30_000; // 30s backoff after failure

export function isMysqlAvailable(): boolean {
  if (!mysqlAvailable) {
    if (Date.now() - lastFailureTimestamp > PROBE_INTERVAL_MS) {
      mysqlAvailable = true; // Probe again
    }
  }
  return mysqlAvailable;
}

export function markMysqlOffline(): void {
  mysqlAvailable = false;
  lastFailureTimestamp = Date.now();
}

export function markMysqlOnline(): void {
  mysqlAvailable = true;
  lastFailureTimestamp = 0;
}

export function getIxWikiPool(): Pool {
  if (!ixwikiPool) {
    ixwikiPool = mysql.createPool({
      host: process.env.IXWIKI_DB_HOST || "localhost",
      port: Number(process.env.IXWIKI_DB_PORT) || 3306,
      user: process.env.IXWIKI_DB_USER || "ixwiki",
      password: process.env.IXWIKI_DB_PASSWORD || "Multico1!",
      database: process.env.IXWIKI_DB_NAME || "ixwiki",
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 4,
      idleTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 1500,
    });
  }
  return ixwikiPool;
}

export function getWikiDbPool(): Pool {
  return getIxWikiPool();
}

/**
 * Graceful shutdown — close MySQL pool.
 */
export async function closeWikiBridge(): Promise<void> {
  if (ixwikiPool) {
    await ixwikiPool.end();
    ixwikiPool = null;
  }
}
