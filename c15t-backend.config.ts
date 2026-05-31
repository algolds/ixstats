import { defineConfig } from "@c15t/backend";
import { prismaAdapter } from "@c15t/backend/db/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineConfig({
  adapter: prismaAdapter({ provider: "postgresql", prisma }),
  basePath: "/api/c15t",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3550",
    "https://ixwiki.com",
    "https://www.ixwiki.com",
  ],
});
