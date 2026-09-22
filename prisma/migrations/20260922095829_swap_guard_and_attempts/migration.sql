-- AlterTable
ALTER TABLE "VerificationCode" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SwapRequest_assignmentId_idx" ON "SwapRequest"("assignmentId");

-- At most one open swap per driving day (not expressible in the Prisma schema).
CREATE UNIQUE INDEX "SwapRequest_open_assignment_key" ON "SwapRequest"("assignmentId")
  WHERE "status" = 'OPEN';
