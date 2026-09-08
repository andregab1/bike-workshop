import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { normalizeChecklistLabel, type BikeChecklistInput } from "@/modules/checklists/schemas/bike-checklist";
import { DomainError } from "@/shared/http/errors";

const include = { customer: { select: { id: true, name: true } }, bike: { select: { id: true, customerId: true, brand: true, model: true } }, items: { orderBy: { sortOrder: "asc" as const } } };
async function validateRelation(context: RequestContext, input: BikeChecklistInput) {
  const bike = await prisma.bike.findFirst({ where: { id: input.bikeId, customerId: input.customerId, workshopId: context.workshopId, active: true, customer: { active: true } }, select: { id: true } });
  if (!bike) throw new DomainError("A bicicleta selecionada não pertence a este cliente ou oficina.", 400, "INVALID_CHECKLIST_BIKE");
  const normalized = input.items.map((item) => ({ ...item, normalizedLabel: normalizeChecklistLabel(item.label) }));
  if (new Set(normalized.map((item) => item.normalizedLabel)).size !== normalized.length) throw new DomainError("O checklist possui itens repetidos.", 400, "DUPLICATE_CHECKLIST_ITEM");
  return normalized;
}

async function updateSuggestions(workshopId: string, items: Array<{ label: string; normalizedLabel: string }>, transaction: Prisma.TransactionClient) {
  for (const item of items) await transaction.checklistItemSuggestion.upsert({ where: { workshopId_normalizedLabel: { workshopId, normalizedLabel: item.normalizedLabel } }, create: { workshopId, label: item.label.trim().replace(/\s+/g, " "), normalizedLabel: item.normalizedLabel }, update: { label: item.label.trim().replace(/\s+/g, " "), useCount: { increment: 1 }, lastUsedAt: new Date() } });
}

export const bikeChecklistService = {
  list(context: RequestContext) { return prisma.bikeChecklist.findMany({ where: { workshopId: context.workshopId, active: true }, include, orderBy: { updatedAt: "desc" } }); },
  suggestions(context: RequestContext) { return prisma.checklistItemSuggestion.findMany({ where: { workshopId: context.workshopId }, orderBy: [{ useCount: "desc" }, { lastUsedAt: "desc" }], take: 50 }); },
  async create(context: RequestContext, input: BikeChecklistInput) { const items = await validateRelation(context, input); return prisma.$transaction(async (transaction) => { const created = await transaction.bikeChecklist.create({ data: { workshopId: context.workshopId, customerId: input.customerId, bikeId: input.bikeId, title: input.title, createdById: context.userId, items: { create: items.map((item, sortOrder) => ({ label: item.label.trim().replace(/\s+/g, " "), normalizedLabel: item.normalizedLabel, checked: item.checked, sortOrder })) } }, include }); await updateSuggestions(context.workshopId, items, transaction); return created; }); },
  async update(context: RequestContext, id: string, input: BikeChecklistInput) { const existing = await prisma.bikeChecklist.findFirst({ where: { id, workshopId: context.workshopId, active: true }, select: { id: true } }); if (!existing) throw new DomainError("Checklist não encontrado.", 404, "BIKE_CHECKLIST_NOT_FOUND"); const items = await validateRelation(context, input); return prisma.$transaction(async (transaction) => { await transaction.bikeChecklistItem.deleteMany({ where: { checklistId: id } }); const updated = await transaction.bikeChecklist.update({ where: { id }, data: { customerId: input.customerId, bikeId: input.bikeId, title: input.title, items: { create: items.map((item, sortOrder) => ({ label: item.label.trim().replace(/\s+/g, " "), normalizedLabel: item.normalizedLabel, checked: item.checked, sortOrder })) } }, include }); await updateSuggestions(context.workshopId, items, transaction); return updated; }); },
  async archive(context: RequestContext, id: string) { const result = await prisma.bikeChecklist.updateMany({ where: { id, workshopId: context.workshopId, active: true }, data: { active: false } }); if (!result.count) throw new DomainError("Checklist não encontrado.", 404, "BIKE_CHECKLIST_NOT_FOUND"); },
};
