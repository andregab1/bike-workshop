-- CreateEnum
CREATE TYPE "QuoteApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderActivityType" ADD VALUE 'MECHANIC_ASSIGNED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE 'QUOTE_APPROVED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE 'QUOTE_REJECTED';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "approvalDecidedAt" TIMESTAMP(3),
ADD COLUMN     "approvalDecidedBy" TEXT,
ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalStatus" "QuoteApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "assignedMechanicName" TEXT;
