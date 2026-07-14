-- CreateTable
CREATE TABLE "TodoDependency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dependentId" INTEGER NOT NULL,
    "dependsOnId" INTEGER NOT NULL,
    CONSTRAINT "TodoDependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TodoDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Todo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "imageUrl" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Todo" ("createdAt", "id", "title") SELECT "createdAt", "id", "title" FROM "Todo";
DROP TABLE "Todo";
ALTER TABLE "new_Todo" RENAME TO "Todo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TodoDependency_dependentId_dependsOnId_key" ON "TodoDependency"("dependentId", "dependsOnId");
