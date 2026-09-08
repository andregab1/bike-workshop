import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/shared/http/errors";

const operationalStatuses = ["OPEN", "IN_PROGRESS"] as const;

async function owned(context: RequestContext, id: string, tx: Prisma.TransactionClient) {
  const order = await tx.workOrder.findFirst({ where: { id, workshopId: context.workshopId } });
  if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
  return order;
}

function activity(context: RequestContext, workOrderId: string, data: { type: "DIAGNOSIS_STARTED" | "DIAGNOSIS_UPDATED" | "STATUS_CHANGED" | "EXECUTION_PAUSED" | "EXECUTION_RESUMED" | "SERVICE_STATUS_CHANGED" | "PART_STATUS_CHANGED" | "CHECKLIST_APPLIED" | "CHECKLIST_UPDATED"; title: string; description?: string; metadata?: Prisma.InputJsonValue }) {
  return { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, ...data };
}

export const workOrderOperationService = {
  async updateDiagnosis(context: RequestContext, id: string, input: { diagnosis: string; recommendations?: string | null; technicalNotes?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (!operationalStatuses.includes(order.status as typeof operationalStatuses[number])) throw new DomainError("Diagnóstico bloqueado para esta OS.", 409, "WORK_ORDER_LOCKED");
      const firstDiagnosis = !order.diagnosisStartedAt && Boolean(input.diagnosis.trim());
      await tx.workOrderActivity.create({ data: activity(context, id, { type: firstDiagnosis ? "DIAGNOSIS_STARTED" : "DIAGNOSIS_UPDATED", title: firstDiagnosis ? "Diagnóstico iniciado" : "Diagnóstico atualizado", metadata: { previousLength: order.diagnosis.length, currentLength: input.diagnosis.length } }) });
      return tx.workOrder.update({ where: { id }, data: { diagnosis: input.diagnosis, technicalRecommendations: input.recommendations, technicalNotes: input.technicalNotes, ...(firstDiagnosis ? { diagnosisStartedAt: new Date() } : {}), version: { increment: 1 } } });
    });
  },

  async updatePlanning(context: RequestContext, id: string, input: { priority?: "NORMAL" | "URGENT" | "WARRANTY_RETURN"; expectedDate?: string | null; expectedNote?: string | null; reason: string }) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new DomainError("Planejamento bloqueado para esta OS.", 409, "WORK_ORDER_LOCKED");
      const nextDate = input.expectedDate === undefined ? order.expectedDate : input.expectedDate ? new Date(`${input.expectedDate}T00:00:00.000Z`) : null;
      await tx.workOrderActivity.create({ data: activity(context, id, { type: "STATUS_CHANGED", title: "Planejamento atualizado", description: input.reason, metadata: { before: { priority: order.priority, expectedDate: order.expectedDate, expectedNote: order.expectedNote }, after: { priority: input.priority ?? order.priority, expectedDate: nextDate, expectedNote: input.expectedNote === undefined ? order.expectedNote : input.expectedNote } } }) });
      return tx.workOrder.update({ where: { id }, data: { ...(input.priority ? { priority: input.priority } : {}), ...(input.expectedDate !== undefined ? { expectedDate: nextDate } : {}), ...(input.expectedNote !== undefined ? { expectedNote: input.expectedNote } : {}), version: { increment: 1 } } });
    });
  },

  async updateServiceStatus(context: RequestContext, orderId: string, lineId: string, status: "PENDING" | "APPROVED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", notes?: string) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, orderId, tx);
      if (order.status !== "IN_PROGRESS") throw new DomainError("Serviços só podem ser executados com a OS em andamento.", 409, "INVALID_TRANSITION");
      const line = await tx.workOrderServiceLine.findFirst({ where: { id: lineId, workOrder: { id: orderId, workshopId: context.workshopId } } });
      if (!line) throw new DomainError("Serviço não encontrado nesta OS.", 404, "SERVICE_LINE_NOT_FOUND");
      await tx.workOrderServiceLine.update({ where: { id: line.id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null } });
      await tx.workOrderActivity.create({ data: activity(context, orderId, { type: "SERVICE_STATUS_CHANGED", title: `Serviço ${status === "COMPLETED" ? "concluído" : "atualizado"}`, description: line.nameSnapshot, metadata: { lineId, previousStatus: line.status, status, notes } }) });
      return tx.workOrder.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    });
  },

  async applyChecklist(context: RequestContext, orderId: string, input: { templateId: string; type: "ENTRY" | "TECHNICAL" | "DELIVERY"; required: boolean }) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, orderId, tx);
      if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new DomainError("Checklist bloqueado para esta OS.", 409, "WORK_ORDER_LOCKED");
      const template = await tx.checklistTemplate.findFirst({ where: { id: input.templateId, workshopId: context.workshopId, active: true }, include: { items: { orderBy: { sortOrder: "asc" } } } });
      if (!template) throw new DomainError("Checklist ativo não encontrado nesta oficina.", 404, "CHECKLIST_TEMPLATE_NOT_FOUND");
      const checklist = await tx.workOrderChecklist.create({ data: { workOrderId: orderId, type: input.type, title: template.name, required: input.required, templateId: template.id, createdById: context.userId, items: { create: template.items.map((item) => ({ labelSnapshot: item.label, required: input.required, sortOrder: item.sortOrder })) } }, include: { items: { orderBy: { sortOrder: "asc" } } } });
      await tx.workOrderActivity.create({ data: activity(context, orderId, { type: "CHECKLIST_APPLIED", title: "Checklist aplicado", description: `${template.name} · ${template.items.length} item(ns).`, metadata: { checklistId: checklist.id, templateId: template.id, type: input.type, required: input.required } }) });
      return checklist;
    });
  },

  async updateChecklistItem(context: RequestContext, orderId: string, itemId: string, input: { result: "PENDING" | "OK" | "ATTENTION" | "REJECTED" | "NOT_APPLICABLE"; notes?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, orderId, tx);
      if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new DomainError("Checklist bloqueado para esta OS.", 409, "WORK_ORDER_LOCKED");
      const item = await tx.workOrderChecklistItem.findFirst({ where: { id: itemId, checklist: { workOrder: { id: orderId, workshopId: context.workshopId } } } });
      if (!item) throw new DomainError("Item de checklist não encontrado nesta OS.", 404, "CHECKLIST_ITEM_NOT_FOUND");
      const updated = await tx.workOrderChecklistItem.update({ where: { id: item.id }, data: { result: input.result, notes: input.notes, verifiedById: input.result === "PENDING" ? null : context.userId, verifiedAt: input.result === "PENDING" ? null : new Date() } });
      await tx.workOrderActivity.create({ data: activity(context, orderId, { type: "CHECKLIST_UPDATED", title: "Checklist atualizado", description: item.labelSnapshot, metadata: { itemId, previousResult: item.result, result: input.result } }) });
      return updated;
    });
  },

  async pause(context: RequestContext, id: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (order.status !== "IN_PROGRESS" || order.executionPausedAt) throw new DomainError("A execução não está ativa.", 409, "INVALID_TRANSITION");
      const now = new Date();
      await tx.workOrderWorkSession.updateMany({ where: { workOrderId: id, status: "ACTIVE" }, data: { status: "PAUSED", endedAt: now } });
      await tx.workOrderActivity.create({ data: activity(context, id, { type: "EXECUTION_PAUSED", title: "Execução pausada", description: reason }) });
      return tx.workOrder.update({ where: { id }, data: { executionPausedAt: now, version: { increment: 1 } } });
    });
  },

  async resume(context: RequestContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (order.status !== "IN_PROGRESS" || !order.executionPausedAt || !order.assignedMechanicId) throw new DomainError("A execução não está pausada ou não possui mecânico.", 409, "INVALID_TRANSITION");
      await tx.workOrderWorkSession.create({ data: { workOrderId: id, mechanicMemberId: order.assignedMechanicId, createdById: context.userId } });
      await tx.workOrderActivity.create({ data: activity(context, id, { type: "EXECUTION_RESUMED", title: "Execução retomada" }) });
      return tx.workOrder.update({ where: { id }, data: { executionPausedAt: null, version: { increment: 1 } } });
    });
  },
};
