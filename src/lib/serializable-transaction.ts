import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isRetryableTransactionError(error: unknown) {
  const transactionError = error as { code?: string; message?: string };
  return transactionError.code === "P2034"
    || transactionError.message?.includes("TransactionWriteConflict")
    || transactionError.message?.includes("write conflict or a deadlock");
}

export async function runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) throw error;
    }
  }

  throw new Error("Serializable transaction retry exhausted.");
}
