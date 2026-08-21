// src/lib/wiki-os/bridge/mysql-pool.ts
// Direct MySQL Connection Pool for IxWiki MariaDB database.

import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

let ixwikiPool: Pool | null = null;

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
      connectTimeout: 5000,
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
