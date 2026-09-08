import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

type DiscountInput = { version: number; type: "FIXED" | "PERCENT"; value: string; reason: string };

export function calculateGeneralDiscount(subtotalCents: number, type: DiscountInput["type"], rawValue: string) {
  const value = new Prisma.Decimal(rawValue.replace(",", "."));
  if (value.isNegative()) throw new DomainError("O desconto não pode ser negativo.", 400, "INVALID_DISCOUNT");
  if (type === "PERCENT" && value.greaterThan(100)) throw new DomainError("O desconto percentual não pode superar 100%.", 400, "INVALID_DISCOUNT");
  const cents = type === "FIXED" ? value.times(100).toDecimalPlaces(0).toNumber() : new Prisma.Decimal(subtotalCents).times(value).dividedBy(100).toDecimalPlaces(0).toNumber();
  if (cents > subtotalCents) throw new DomainError("O desconto não pode superar o subtotal da OS.", 400, "INVALID_DISCOUNT");
  return { value, cents };
}

export const workOrderDiscountService = {
  update(context: RequestContext, workOrderId: string, input: DiscountInput) {
    requirePermission(context, "APPLY_DISCOUNT");
    return prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findFirst({ where: { id: workOrderId, workshopId: context.workshopId } });
      if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
      if (!["OPEN", "IN_PROGRESS"].includes(order.status)) throw new DomainError("O desconto não pode ser alterado neste estado.", 409, "WORK_ORDER_LOCKED");
      if (order.version !== input.version) throw new DomainError("A OS foi alterada em outra ação. Recarregue antes de salvar.", 409, "STALE_WORK_ORDER");
      const subtotalCents = order.laborSubtotalCents + order.partsSubtotalCents + order.generalSurchargeCents;
      const discount = calculateGeneralDiscount(subtotalCents, input.type, input.value);
      if (order.generalDiscountCents === discount.cents && order.generalDiscountType === input.type && order.generalDiscountValue.equals(discount.value)) return order;
      await tx.workOrderActivity.create({ data: { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: "DISCOUNT_CHANGED", title: "Desconto alterado", description: input.reason, metadata: { before: { type: order.generalDiscountType, value: order.generalDiscountValue.toString(), cents: order.generalDiscountCents }, after: { type: input.type, value: discount.value.toString(), cents: discount.cents } } } });
      return tx.workOrder.update({ where: { id: order.id }, data: { generalDiscountType: input.type, generalDiscountValue: discount.value, generalDiscountCents: discount.cents, totalCents: Math.max(0, subtotalCents - discount.cents), approvalStatus: "PENDING", approvalNote: null, approvalDecidedAt: null, approvalDecidedBy: null, version: { increment: 1 } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
