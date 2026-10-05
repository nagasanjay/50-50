/*
  Warnings:

  - You are about to drop the `GroupInvite` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- DataMigration: convert any outstanding GroupInvite rows into pending (no-password) users
-- plus a GroupMember row, so they keep working as split participants after GroupInvite is dropped.
INSERT INTO "User" (id, email, "passwordHash", name, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, dedup.email, NULL, dedup.name, dedup."createdAt", dedup."createdAt"
FROM (
  SELECT DISTINCT ON (email) email, name, "createdAt"
  FROM "GroupInvite"
  ORDER BY email, "createdAt" ASC
) dedup
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.email = dedup.email);

INSERT INTO "GroupMember" (id, "groupId", "userId", role, "joinedAt")
SELECT gen_random_uuid()::text, gi."groupId", u.id, 'MEMBER', gi."createdAt"
FROM "GroupInvite" gi
JOIN "User" u ON u.email = gi.email
WHERE NOT EXISTS (
  SELECT 1 FROM "GroupMember" gm WHERE gm."groupId" = gi."groupId" AND gm."userId" = u.id
);

-- DropForeignKey
ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_groupId_fkey";

-- DropTable
DROP TABLE "GroupInvite";
