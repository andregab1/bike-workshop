CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_workshopId_fkey"
FOREIGN KEY ("workshopId") REFERENCES "workshops"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "audit_logs_workshopId_createdAt_idx"
ON "audit_logs"("workshopId", "createdAt");

CREATE INDEX "audit_logs_workshopId_entityType_entityId_idx"
ON "audit_logs"("workshopId", "entityType", "entityId");

CREATE INDEX "audit_logs_actorUserId_createdAt_idx"
ON "audit_logs"("actorUserId", "createdAt");
