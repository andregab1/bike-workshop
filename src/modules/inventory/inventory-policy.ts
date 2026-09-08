import { Prisma } from "@/generated/prisma/client";

export function weightedAverageCost(
  currentQuantity: Prisma.Decimal,
  currentCostCents: number | null,
  incomingQuantity: Prisma.Decimal,
  incomingCostCents?: number,
) {
  if (incomingCostCents === undefined) return currentCostCents ?? undefined;
  if (currentCostCents === null || currentQuantity.isZero()) return incomingCostCents;
  return currentQuantity.mul(currentCostCents)
    .plus(incomingQuantity.mul(incomingCostCents))
    .div(currentQuantity.plus(incomingQuantity))
    .toDecimalPlaces(0)
    .toNumber();
}
