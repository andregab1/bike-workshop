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
  throw new DomainError("Não foi possível concluir o orçamento. Tente novamente.", 409, "CONCURRENT_QUOTE_CHANGE");
}

async function owned(context: RequestContext, id: string, tx: Prisma.TransactionClient) {
  const order = await tx.workOrder.findFirst({ where: { id, workshopId: context.workshopId }, include: { workshop: { select: { reservationPolicy: true } }, services: true, parts: true } });
  if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
  return order;
}

export const workOrderQuoteService = {
  generate(context: RequestContext, workOrderId: string, input: { validUntil?: string | null; kind: "BASE" | "ADDITIONAL" }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return serializable(async (tx) => {
      const order = await owned(context, workOrderId, tx);
      if (!["OPEN", "IN_PROGRESS"].includes(order.status)) throw new DomainError("Não é possível gerar orçamento neste estado.", 409, "INVALID_QUOTE_STATE");
      if (!order.services.length && !order.parts.length) throw new DomainError("Adicione serviços ou peças antes de gerar o orçamento.", 400, "EMPTY_QUOTE");
      const sameDraft = await tx.workOrderQuote.findFirst({ where: { workOrderId, status: "DRAFT", sourceWorkOrderVersion: order.version }, orderBy: { version: "desc" } });
      if (sameDraft) return sameDraft;
      await tx.workOrderQuote.updateMany({ where: { workOrderId, status: "DRAFT" }, data: { status: "SUPERSEDED" } });
      const [version, additional] = await Promise.all([
        tx.workOrderQuote.aggregate({ where: { workOrderId }, _max: { version: true } }),
        tx.workOrderQuote.aggregate({ where: { workOrderId, kind: "ADDITIONAL" }, _max: { additionalNumber: true } }),
      ]);
      const quote = await tx.workOrderQuote.create({ data: {
        workOrderId,
        version: (version._max.version ?? 0) + 1,
        kind: input.kind,
        additionalNumber: input.kind === "ADDITIONAL" ? (additional._max.additionalNumber ?? 0) + 1 : null,
        sourceWorkOrderVersion: order.version,
        validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
        subtotalCents: order.laborSubtotalCents + order.partsSubtotalCents,
        discountCents: order.generalDiscountCents,
        surchargeCents: order.generalSurchargeCents,
        totalCents: order.totalCents,
        serviceSnapshot: order.services.map((line) => ({ id: line.id, serviceCatalogItemId: line.serviceCatalogItemId, description: line.nameSnapshot, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: line.totalCents })),
        partSnapshot: order.parts.map((line) => ({ id: line.id, inventoryItemId: line.inventoryItemId, description: line.nameSnapshot, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: line.totalCents })),
        createdById: context.userId,
      } });
      await tx.workOrderActivity.create({ data: { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: "QUOTE_CREATED", title: input.kind === "ADDITIONAL" ? `Adicional #${quote.additionalNumber} criado` : `Orçamento v${quote.version} criado`, metadata: { quoteId: quote.id, version: quote.version, totalCents: quote.totalCents } } });
      return quote;
    });
  },

  send(context: RequestContext, workOrderId: string, quoteId: string) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, workOrderId, tx);
      const quote = await tx.workOrderQuote.findFirst({ where: { id: quoteId, workOrderId } });
      if (!quote) throw new DomainError("Orçamento não encontrado nesta OS.", 404, "QUOTE_NOT_FOUND");
      if (quote.status === "PENDING" && quote.sentAt) return quote;
      if (quote.status !== "DRAFT") throw new DomainError("Somente orçamento em rascunho pode ser enviado.", 409, "INVALID_QUOTE_STATE");
      const sentAt = new Date();
      await tx.workOrder.update({ where: { id: order.id }, data: { approvalStatus: "PENDING", approvalRequestedAt: sentAt, version: { increment: 1 } } });
      await tx.workOrderServiceLine.updateMany({ where: { workOrderId }, data: { status: "PENDING" } });
      await tx.workOrderPartLine.updateMany({ where: { workOrderId }, data: { status: "PENDING" } });
      await tx.workOrderActivity.create({ data: { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: "QUOTE_SENT", title: `Orçamento v${quote.version} enviado`, metadata: { quoteId, version: quote.version } } });
      return tx.workOrderQuote.update({ where: { id: quote.id }, data: { status: "PENDING", sentAt } });
    });
  },

  decide(context: RequestContext, workOrderId: string, quoteId: string, decision: "APPROVED" | "REJECTED", input: { channel: "IN_PERSON" | "WHATSAPP" | "PHONE" | "EMAIL" | "OTHER"; approvedByName?: string; evidence?: string; note?: string; serviceLineIds?: string[]; partLineIds?: string[] }) {
    requirePermission(context, "APPROVE_QUOTE");
    return serializable(async (tx) => {
      const order = await owned(context, workOrderId, tx);
      const quote = await tx.workOrderQuote.findFirst({ where: { id: quoteId, workOrderId } });
      if (!quote) throw new DomainError("Orçamento não encontrado nesta OS.", 404, "QUOTE_NOT_FOUND");
      if (["APPROVED", "PARTIALLY_APPROVED", "REJECTED"].includes(quote.status)) return quote;
      if (!["DRAFT", "PENDING"].includes(quote.status)) throw new DomainError("Este orçamento não pode mais ser decidido.", 409, "INVALID_QUOTE_STATE");
      const allServiceIds = order.services.map((line) => line.id);
      const allPartIds = order.parts.map((line) => line.id);
      const selectedServices = decision === "REJECTED" ? [] : input.serviceLineIds ?? allServiceIds;
      const selectedParts = decision === "REJECTED" ? [] : input.partLineIds ?? allPartIds;
      if (selectedServices.some((id) => !allServiceIds.includes(id)) || selectedParts.some((id) => !allPartIds.includes(id))) throw new DomainError("Há itens que não pertencem a este orçamento.", 400, "INVALID_QUOTE_ITEMS");
      const selectedCount = new Set([...selectedServices, ...selectedParts]).size;
      const totalCount = allServiceIds.length + allPartIds.length;
      const result = decision === "REJECTED" || selectedCount === 0 ? "REJECTED" : selectedCount === totalCount ? "APPROVED" : "PARTIALLY_APPROVED";
      const approvedPartSet = new Set(selectedParts);
      await Promise.all(order.services.map((line) => tx.workOrderServiceLine.update({ where: { id: line.id }, data: { status: selectedServices.includes(line.id) ? "APPROVED" : "REJECTED" } })));
      await Promise.all(order.parts.map((line) => tx.workOrderPartLine.update({ where: { id: line.id }, data: { status: approvedPartSet.has(line.id) ? "APPROVED" : "REJECTED" } })));
      if (result !== "REJECTED" && order.workshop.reservationPolicy === "ON_QUOTE_APPROVAL") await reconcileReservations(context, order.id, order.number, order.parts.filter((line) => approvedPartSet.has(line.id)), tx);
      if (result === "REJECTED") await reconcileReservations(context, order.id, order.number, [], tx);
      const respondedAt = new Date();
      await tx.workOrderQuoteApproval.create({ data: { quoteId, channel: input.channel, decision: result, approvedByName: input.approvedByName, evidence: input.evidence, notes: input.note, approvedServiceLineIds: selectedServices, approvedPartLineIds: selectedParts, recordedById: context.userId } });
      await tx.workOrderQuote.update({ where: { id: quote.id }, data: { status: result, respondedAt } });
      await tx.workOrder.update({ where: { id: order.id }, data: { approvalStatus: result, approvalNote: input.note, approvalDecidedAt: respondedAt, approvalDecidedBy: context.userId, version: { increment: 1 } } });
      await tx.workOrderActivity.create({ data: { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: result === "APPROVED" ? "QUOTE_APPROVED" : result === "PARTIALLY_APPROVED" ? "QUOTE_PARTIALLY_APPROVED" : "QUOTE_REJECTED", title: result === "APPROVED" ? "Orçamento aprovado" : result === "PARTIALLY_APPROVED" ? "Orçamento aprovado parcialmente" : "Orçamento recusado", description: input.note, metadata: { quoteId, version: quote.version, channel: input.channel, selectedServices, selectedParts } } });
      return tx.workOrderQuote.findUniqueOrThrow({ where: { id: quote.id }, include: { approvals: true } });
    });
  },
};
