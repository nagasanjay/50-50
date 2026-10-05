-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "deletedAt" TIMESTAMP(3);
