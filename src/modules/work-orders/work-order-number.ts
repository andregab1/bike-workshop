import type { Prisma } from "@/generated/prisma/client";

export async function takeNextWorkOrderNumber(tx: Prisma.TransactionClient, workshopId: string) {
  const counter = await tx.workOrderCounter.upsert({
    where: { workshopId },
    create: { workshopId, nextNumber: 1002 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });

  return counter.nextNumber - 1;
}
