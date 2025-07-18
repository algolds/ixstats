-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "countryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "href" TEXT,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
