import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { reconcileReservations } from "@/modules/work-orders/services/work-order-service";
import { requirePermission } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) { if ((error as { code?: string }).code !== "P2034" || attempt === 2) throw error; }
  }
  throw new DomainError("A OS foi alterada ao mesmo tempo. Tente novamente.", 409, "CONCURRENT_WORK_ORDER_CHANGE");
}

async function owned(context: RequestContext, id: string, tx: Prisma.TransactionClient) {
  const order = await tx.workOrder.findFirst({ where: { id, workshopId: context.workshopId }, include: { services: true, parts: true, reservations: true } });
  if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
  if (!["OPEN", "IN_PROGRESS"].includes(order.status)) throw new DomainError("Itens não podem ser alterados neste estado.", 409, "WORK_ORDER_LOCKED");
  return order;
}

async function updateTotals(tx: Prisma.TransactionClient, orderId: string) {
  const [services, parts, order] = await Promise.all([
    tx.workOrderServiceLine.aggregate({ where: { workOrderId: orderId }, _sum: { totalCents: true } }),
    tx.workOrderPartLine.aggregate({ where: { workOrderId: orderId }, _sum: { totalCents: true } }),
    tx.workOrder.findUniqueOrThrow({ where: { id: orderId }, select: { generalDiscountCents: true, generalSurchargeCents: true } }),
  ]);
  const laborSubtotalCents = services._sum.totalCents ?? 0;
  const partsSubtotalCents = parts._sum.totalCents ?? 0;
  const totalCents = Math.max(0, laborSubtotalCents + partsSubtotalCents - order.generalDiscountCents + order.generalSurchargeCents);
  await tx.workOrder.update({ where: { id: orderId }, data: { laborSubtotalCents, partsSubtotalCents, totalCents, approvalStatus: "PENDING", approvalNote: null, approvalDecidedAt: null, approvalDecidedBy: null, version: { increment: 1 } } });
}

function activity(context: RequestContext, workOrderId: string, title: string, description: string, metadata: Prisma.InputJsonValue) {
  return { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: "ITEMS_UPDATED" as const, title, description, metadata };
}

export const workOrderItemService = {
  addService(context: RequestContext, orderId: string, input: { serviceCatalogItemId: string; quantity: number; performedById?: string | null }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      await owned(context, orderId, tx);
      const catalog = await tx.serviceCatalogItem.findFirst({ where: { id: input.serviceCatalogItemId, workshopId: context.workshopId, active: true } });
      if (!catalog) throw new DomainError("Serviço ativo não encontrado nesta oficina.", 404, "SERVICE_NOT_FOUND");
      if (input.performedById && !await tx.workshopMember.findFirst({ where: { id: input.performedById, workshopId: context.workshopId, active: true, role: { in: ["OWNER", "MANAGER", "MECHANIC"] } } })) throw new DomainError("Executor ativo não encontrado nesta oficina.", 400, "INVALID_PERFORMER");
      const existing = await tx.workOrderServiceLine.findFirst({ where: { workOrderId: orderId, serviceCatalogItemId: catalog.id, status: { notIn: ["CANCELLED", "REJECTED"] } } });
      const quantity = existing ? Number(existing.quantity) + input.quantity : input.quantity;
      const totalCents = Math.round(quantity * catalog.priceCents);
      const line = existing
        ? await tx.workOrderServiceLine.update({ where: { id: existing.id }, data: { quantity: new Prisma.Decimal(quantity), unitPriceCents: catalog.priceCents, totalCents, status: "PENDING", performedById: input.performedById } })
        : await tx.workOrderServiceLine.create({ data: { workOrderId: orderId, serviceCatalogItemId: catalog.id, nameSnapshot: catalog.name, quantity: new Prisma.Decimal(input.quantity), unitPriceCents: catalog.priceCents, totalCents: Math.round(input.quantity * catalog.priceCents), performedById: input.performedById, warrantyDaysSnapshot: catalog.warrantyDays } });
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, existing ? "Quantidade do serviço alterada" : "Serviço adicionado", catalog.name, { lineId: line.id, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents }) });
      return line;
    });
  },

  removeService(context: RequestContext, orderId: string, lineId: string) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      await owned(context, orderId, tx);
      const line = await tx.workOrderServiceLine.findFirst({ where: { id: lineId, workOrder: { id: orderId, workshopId: context.workshopId } } });
      if (!line) throw new DomainError("Serviço não encontrado nesta OS.", 404, "SERVICE_LINE_NOT_FOUND");
      await tx.workOrderServiceLine.delete({ where: { id: line.id } });
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, "Serviço removido", line.nameSnapshot, { lineId, quantity: String(line.quantity), totalCents: line.totalCents }) });
      return { id: line.id };
    });
  },

  updateService(context: RequestContext, orderId: string, lineId: string, input: { quantity: number; discountCents: number; reason: string; performedById?: string | null }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      await owned(context, orderId, tx);
      const line = await tx.workOrderServiceLine.findFirst({ where: { id: lineId, workOrder: { id: orderId, workshopId: context.workshopId } } });
      if (!line) throw new DomainError("Serviço não encontrado nesta OS.", 404, "SERVICE_LINE_NOT_FOUND");
      if (input.performedById && !await tx.workshopMember.findFirst({ where: { id: input.performedById, workshopId: context.workshopId, active: true, role: { in: ["OWNER", "MANAGER", "MECHANIC"] } } })) throw new DomainError("Executor ativo não encontrado nesta oficina.", 400, "INVALID_PERFORMER");
      const subtotal = Math.round(input.quantity * line.unitPriceCents) + line.surchargeCents;
      if (input.discountCents > subtotal) throw new DomainError("O desconto não pode superar o valor do serviço.", 400, "INVALID_DISCOUNT");
      const updated = await tx.workOrderServiceLine.update({ where: { id: line.id }, data: { quantity: new Prisma.Decimal(input.quantity), discountCents: input.discountCents, totalCents: subtotal - input.discountCents, performedById: input.performedById, status: "PENDING", completedAt: null } });
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, "Serviço atualizado", line.nameSnapshot, { lineId, before: { quantity: String(line.quantity), discountCents: line.discountCents, performedById: line.performedById }, after: { quantity: String(updated.quantity), discountCents: updated.discountCents, performedById: updated.performedById }, reason: input.reason }) });
      return updated;
    });
  },

  addPart(context: RequestContext, orderId: string, input: { inventoryItemId: string; quantity: number }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      const order = await owned(context, orderId, tx);
      const item = await tx.inventoryItem.findFirst({ where: { id: input.inventoryItemId, workshopId: context.workshopId, active: true }, include: { catalogPart: true } });
      if (!item) throw new DomainError("Peça ativa não encontrada nesta oficina.", 404, "INVENTORY_ITEM_NOT_FOUND");
      const name = item.customName || item.catalogPart?.name || item.sku || "Peça";
      const existing = await tx.workOrderPartLine.findFirst({ where: { workOrderId: orderId, inventoryItemId: item.id, status: { notIn: ["CANCELLED", "REJECTED"] } } });
      const quantity = existing ? Number(existing.quantity) + input.quantity : input.quantity;
      const totalCents = Math.round(quantity * item.salePriceCents);
      const line = existing
        ? await tx.workOrderPartLine.update({ where: { id: existing.id }, data: { quantity: new Prisma.Decimal(quantity), unitPriceCents: item.salePriceCents, totalCents, status: "PENDING", unitCostCents: item.costPriceCents, locationSnapshot: item.location } })
        : await tx.workOrderPartLine.create({ data: { workOrderId: orderId, inventoryItemId: item.id, nameSnapshot: name, quantity: new Prisma.Decimal(input.quantity), unitPriceCents: item.salePriceCents, unitCostCents: item.costPriceCents, locationSnapshot: item.location, totalCents: Math.round(input.quantity * item.salePriceCents) } });
      if (order.reservations.some((reservation) => reservation.status === "ACTIVE")) {
        const parts = await tx.workOrderPartLine.findMany({ where: { workOrderId: orderId } });
        await reconcileReservations(context, orderId, order.number, parts, tx);
      }
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, existing ? "Quantidade da peça alterada" : "Peça adicionada", name, { lineId: line.id, inventoryItemId: item.id, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents }) });
      return line;
    });
  },

  removePart(context: RequestContext, orderId: string, lineId: string) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      const order = await owned(context, orderId, tx);
      const line = await tx.workOrderPartLine.findFirst({ where: { id: lineId, workOrder: { id: orderId, workshopId: context.workshopId } } });
      if (!line) throw new DomainError("Peça não encontrada nesta OS.", 404, "PART_LINE_NOT_FOUND");
      await tx.workOrderPartLine.delete({ where: { id: line.id } });
      if (order.reservations.some((reservation) => reservation.status === "ACTIVE")) {
        const remaining = await tx.workOrderPartLine.findMany({ where: { workOrderId: orderId } });
        await reconcileReservations(context, orderId, order.number, remaining, tx);
      }
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, "Peça removida", line.nameSnapshot, { lineId, inventoryItemId: line.inventoryItemId, quantity: String(line.quantity), totalCents: line.totalCents }) });
      return { id: line.id };
    });
  },

  updatePart(context: RequestContext, orderId: string, lineId: string, input: { quantity: number; discountCents: number; reason: string }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      const order = await owned(context, orderId, tx);
      const line = await tx.workOrderPartLine.findFirst({ where: { id: lineId, workOrder: { id: orderId, workshopId: context.workshopId } } });
      if (!line) throw new DomainError("Peça não encontrada nesta OS.", 404, "PART_LINE_NOT_FOUND");
      const subtotal = Math.round(input.quantity * line.unitPriceCents) + line.surchargeCents;
      if (input.discountCents > subtotal) throw new DomainError("O desconto não pode superar o valor da peça.", 400, "INVALID_DISCOUNT");
      const updated = await tx.workOrderPartLine.update({ where: { id: line.id }, data: { quantity: new Prisma.Decimal(input.quantity), discountCents: input.discountCents, totalCents: subtotal - input.discountCents, status: "PENDING" } });
      if (order.reservations.some((reservation) => reservation.status === "ACTIVE")) {
        const parts = await tx.workOrderPartLine.findMany({ where: { workOrderId: orderId } });
        await reconcileReservations(context, orderId, order.number, parts, tx);
      }
      await updateTotals(tx, orderId);
      await tx.workOrderActivity.create({ data: activity(context, orderId, "Peça atualizada", line.nameSnapshot, { lineId, before: { quantity: String(line.quantity), discountCents: line.discountCents }, after: { quantity: String(updated.quantity), discountCents: updated.discountCents }, reason: input.reason }) });
      return updated;
    });
  },
};
