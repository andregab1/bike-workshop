import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { workOrderListQuerySchema } from "@/modules/work-orders/schemas/work-order";
import type { CreateWorkOrderInput, UpdateWorkOrderInput } from "@/modules/work-orders/schemas/work-order";
import type { z } from "zod";
import { DomainError } from "@/shared/http/errors";
import { requirePermission } from "@/shared/auth/permissions";
import { workOrderSensitiveChanges } from "@/modules/work-orders/work-order-pricing-policy";
import { blockingPendingsFor, calculateWorkOrderPendings, canRunWorkOrderCommand } from "@/modules/work-orders/work-order-rules";
import { takeNextWorkOrderNumber } from "@/modules/work-orders/work-order-number";
import { createBikeSnapshot, createCustomerSnapshot } from "@/modules/work-orders/work-order-snapshots";

const include = { workshop: { select: { name: true, slug: true, phone: true, email: true, reservationPolicy: true, requirePaymentBeforeCompletion: true } }, bike: { include: { customer: true } }, customerSnapshot: true, assignedMechanic: { include: { user: { select: { name: true } } } }, services: true, parts: { include: { inventoryItem: { include: { brand: true, category: true, catalogPart: { include: { brand: true, category: true } } } } } }, reservations: true, quotes: { include: { approvals: true }, orderBy: { version: "desc" as const } }, checklists: { include: { items: { orderBy: { sortOrder: "asc" as const } } }, orderBy: { createdAt: "asc" as const } }, attachments: { orderBy: { createdAt: "desc" as const } }, workSessions: { orderBy: { startedAt: "desc" as const } }, activities: { orderBy: { createdAt: "desc" as const } } } as const;
const editable = ["OPEN", "IN_PROGRESS"] as const;

function lineTotal(line: { quantity: number; unitPriceCents: number; discountCents?: number; surchargeCents?: number }) { return Math.max(0, Math.round(line.quantity * line.unitPriceCents) - (line.discountCents || 0) + (line.surchargeCents || 0)); }
function totals(services: CreateWorkOrderInput["services"], parts: CreateWorkOrderInput["parts"]) {
  const laborSubtotalCents = services.reduce((sum, line) => sum + lineTotal(line), 0);
  const partsSubtotalCents = parts.reduce((sum, line) => sum + lineTotal(line), 0);
  return { laborSubtotalCents, partsSubtotalCents, totalCents: laborSubtotalCents + partsSubtotalCents };
}

async function assertReferences(context: RequestContext, bikeId: string | undefined, services: CreateWorkOrderInput["services"], parts: CreateWorkOrderInput["parts"], tx: Prisma.TransactionClient) {
  if (bikeId && !await tx.bike.findFirst({ where: { id: bikeId, workshopId: context.workshopId, active: true, customer: { active: true } } })) throw new DomainError("Bicicleta ativa não encontrada nesta oficina.", 404, "BIKE_NOT_FOUND");
  const serviceIds = services.flatMap((line) => line.serviceCatalogItemId ? [line.serviceCatalogItemId] : []);
  if (serviceIds.length && await tx.serviceCatalogItem.count({ where: { id: { in: serviceIds }, workshopId: context.workshopId } }) !== new Set(serviceIds).size) throw new DomainError("Serviço inválido para esta oficina.", 400, "INVALID_SERVICE");
  const performerIds = [...new Set(services.flatMap((line) => line.performedById ? [line.performedById] : []))];
  if (performerIds.length && await tx.workshopMember.count({ where: { id: { in: performerIds }, workshopId: context.workshopId, active: true, role: { in: ["OWNER", "MANAGER", "MECHANIC"] } } }) !== performerIds.length) throw new DomainError("Executor inválido para esta oficina.", 400, "INVALID_PERFORMER");
  const partIds = [...new Set(parts.map((line) => line.inventoryItemId))];
  if (partIds.length && await tx.inventoryItem.count({ where: { id: { in: partIds }, workshopId: context.workshopId, active: true } }) !== partIds.length) throw new DomainError("Peça inválida para esta oficina.", 400, "INVALID_PART");
}

async function serviceRows(rows: CreateWorkOrderInput["services"], tx: Prisma.TransactionClient) {
  const ids = [...new Set(rows.flatMap((line) => line.serviceCatalogItemId ? [line.serviceCatalogItemId] : []))];
  const catalog = ids.length ? await tx.serviceCatalogItem.findMany({ where: { id: { in: ids } }, select: { id: true, warrantyDays: true } }) : [];
  const warranties = new Map(catalog.map((item) => [item.id, item.warrantyDays]));
  return rows.map((line) => ({ serviceCatalogItemId: line.serviceCatalogItemId, nameSnapshot: line.name, quantity: new Prisma.Decimal(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: lineTotal(line), performedById: line.performedById, warrantyDaysSnapshot: line.serviceCatalogItemId ? warranties.get(line.serviceCatalogItemId) ?? null : null }));
}
const partRows = (rows: CreateWorkOrderInput["parts"]) => rows.map((line) => ({ inventoryItemId: line.inventoryItemId, nameSnapshot: line.name, quantity: new Prisma.Decimal(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: lineTotal(line) }));
const databaseDate = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00.000Z`) : null;

function enrichOrder<T extends Awaited<ReturnType<typeof owned>>>(order: T) {
  const pendings = calculateWorkOrderPendings({
    status: order.status,
    approvalStatus: order.approvalStatus,
    assignedMechanicId: order.assignedMechanicId,
    diagnosis: order.diagnosis,
    executionPausedAt: order.executionPausedAt,
    services: order.services,
    checklists: order.checklists,
    paymentRequired: order.workshop.requirePaymentBeforeCompletion,
    paymentStatus: order.paymentStatus,
  });
  const timeline = [
    { key: "entry", label: "Entrada", at: order.createdAt, complete: true },
    { key: "diagnosis", label: "Diagnóstico", at: order.diagnosisStartedAt, complete: Boolean(order.diagnosisStartedAt || order.diagnosis.trim()) },
    { key: "approval", label: "Aprovação", at: order.approvalDecidedAt, complete: order.approvalStatus === "APPROVED" },
    { key: "execution", label: "Em execução", at: order.startedAt, complete: Boolean(order.startedAt) },
    { key: "ready", label: "Pronta", at: order.readyAt, complete: Boolean(order.readyAt) },
    { key: "delivery", label: "Entregue", at: order.completedAt, complete: Boolean(order.completedAt) },
  ];
  return { ...order, pendings, timeline };
}

async function owned(context: RequestContext, id: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const order = await tx.workOrder.findFirst({ where: { id, workshopId: context.workshopId }, include });
  if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
  return order;
}

async function reverseOutstandingStock(context: RequestContext, order: Awaited<ReturnType<typeof owned>>, tx: Prisma.TransactionClient, reason: string) {
  const movements = await tx.inventoryMovement.findMany({ where: { workOrderId: order.id, type: { in: ["WORK_ORDER_USE", "WORK_ORDER_REVERSAL"] } } });
  const outstanding = new Map<string, Prisma.Decimal>(); for (const movement of movements) outstanding.set(movement.inventoryItemId, (outstanding.get(movement.inventoryItemId) || new Prisma.Decimal(0)).plus(movement.quantityDelta));
  for (const [inventoryItemId, net] of outstanding) { const qty = net.negated(); if (!qty.isPositive()) continue; const before = await tx.inventoryItem.findFirstOrThrow({ where: { id: inventoryItemId, workshopId: context.workshopId } }); const after = await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { quantity: { increment: qty } } }); await tx.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId, workOrderId: order.id, type: "WORK_ORDER_REVERSAL", quantityDelta: qty, reason, originDestination: `Estorno OS #${order.number}`, physicalBefore: before.quantity, physicalAfter: after.quantity, reservedBefore: before.reservedQuantity, reservedAfter: after.reservedQuantity, createdById: context.userId } }); }
}

async function releaseReservations(context: RequestContext, workOrderId: string, tx: Prisma.TransactionClient, reason: string) {
  const active = await tx.inventoryReservation.findMany({ where: { workshopId: context.workshopId, workOrderId, status: "ACTIVE" } });
  for (const reservation of active) {
    const before = await tx.inventoryItem.findFirstOrThrow({ where: { id: reservation.inventoryItemId, workshopId: context.workshopId } });
    const after = await tx.inventoryItem.update({ where: { id: reservation.inventoryItemId }, data: { reservedQuantity: { decrement: reservation.quantity } } });
    await tx.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: reservation.inventoryItemId, workOrderId, type: "RESERVATION_RELEASE", quantityDelta: reservation.quantity, reason, originDestination: "Liberação de reserva da OS", physicalBefore: before.quantity, physicalAfter: after.quantity, reservedBefore: before.reservedQuantity, reservedAfter: after.reservedQuantity, createdById: context.userId } });
  }
  if (active.length) await tx.inventoryReservation.updateMany({ where: { id: { in: active.map((item) => item.id) } }, data: { status: "RELEASED", releasedById: context.userId, releaseReason: reason } });
}

export async function reconcileReservations(context: RequestContext, workOrderId: string, orderNumber: number, parts: Array<{ inventoryItemId: string; quantity: Prisma.Decimal | number }>, tx: Prisma.TransactionClient) {
  const grouped = new Map<string, Prisma.Decimal>();
  for (const line of parts) grouped.set(line.inventoryItemId, (grouped.get(line.inventoryItemId) || new Prisma.Decimal(0)).plus(line.quantity));
  const active = await tx.inventoryReservation.findMany({ where: { workshopId: context.workshopId, workOrderId, status: "ACTIVE" } });
  const current = new Map(active.map((reservation) => [reservation.inventoryItemId, reservation]));
  for (const inventoryItemId of new Set([...grouped.keys(), ...current.keys()])) {
    const quantity = grouped.get(inventoryItemId) || new Prisma.Decimal(0); const reservation = current.get(inventoryItemId); const previous = reservation?.quantity || new Prisma.Decimal(0); const delta = quantity.minus(previous);
    if (delta.isZero()) continue;
    const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, workshopId: context.workshopId, active: true } });
    if (!item) throw new DomainError("Peça não encontrada nesta oficina.", 404, "INVENTORY_ITEM_NOT_FOUND");
    const available = item.quantity.minus(item.reservedQuantity);
    if (delta.isPositive() && available.lessThan(delta)) throw new DomainError(`Estoque insuficiente. Disponível: ${available} unidade(s).`, 409, "INSUFFICIENT_AVAILABLE_STOCK");
    const after = await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { reservedQuantity: delta.isPositive() ? { increment: delta } : { decrement: delta.abs() } } });
    if (quantity.isZero() && reservation) await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED", releasedById: context.userId, releaseReason: "Peça removida ou quantidade reduzida" } });
    else if (reservation) await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { quantity } });
    else await tx.inventoryReservation.create({ data: { workshopId: context.workshopId, workOrderId, inventoryItemId, quantity, createdById: context.userId } });
    await tx.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId, workOrderId, type: delta.isPositive() ? "STOCK_RESERVATION" : "RESERVATION_RELEASE", quantityDelta: delta.isPositive() ? delta.negated() : delta.abs(), reason: delta.isPositive() ? `Reserva para OS #${orderNumber}` : `Reserva reduzida da OS #${orderNumber}`, originDestination: `OS #${orderNumber}`, physicalBefore: item.quantity, physicalAfter: after.quantity, reservedBefore: item.reservedQuantity, reservedAfter: after.reservedQuantity, createdById: context.userId } });
  }
}

async function reserveOrderParts(context: RequestContext, order: Awaited<ReturnType<typeof owned>>, tx: Prisma.TransactionClient) { await reconcileReservations(context, order.id, order.number, order.parts.filter((line) => line.status === "APPROVED"), tx); }

export const workOrderService = {
  async list(context: RequestContext, query: z.infer<typeof workOrderListQuerySchema>) {
    const numeric = /^#?(\d+)$/.exec(query.search || "");
    const where: Prisma.WorkOrderWhereInput = { workshopId: context.workshopId, ...(query.includeRejected === "true" ? {} : { approvalStatus: { not: "REJECTED" } }), ...(query.status ? { status: query.status } : {}), ...(query.mechanicId ? { assignedMechanicId: query.mechanicId } : {}), ...(query.late === "true" ? { expectedDate: { lt: new Date() }, status: { in: ["OPEN", "IN_PROGRESS"] } } : {}), ...(query.search ? { OR: [...(numeric ? [{ number: Number(numeric[1]) }] : []), { bike: { is: { OR: [{ brand: { contains: query.search, mode: "insensitive" } }, { model: { contains: query.search, mode: "insensitive" } }, { serialNumber: { contains: query.search, mode: "insensitive" } }, { customer: { is: { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { phone: { contains: query.search } }] } } }] } } }] } : {}) };
    const orderBy: Prisma.WorkOrderOrderByWithRelationInput = query.sort === "number_asc" ? { number: "asc" } : query.sort === "updated_desc" ? { updatedAt: "desc" } : query.sort === "expected_asc" ? { expectedDate: { sort: "asc", nulls: "last" } } : { number: "desc" };
    const [items, total] = await prisma.$transaction([prisma.workOrder.findMany({ where, select: { id: true, number: true, version: true, status: true, complaint: true, expectedDate: true, expectedNote: true, laborSubtotalCents: true, partsSubtotalCents: true, totalCents: true, assignedMechanicId: true, assignedMechanicName: true, approvalStatus: true, bikeId: true, customerSnapshotId: true, customerSnapshotData: true, bikeSnapshotData: true, bike: { include: { customer: true } }, customerSnapshot: true, workshop: { select: { name: true, slug: true } } }, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.workOrder.count({ where })]);
    return { items, page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) };
  },
  async get(context: RequestContext, id: string) {
    const order = await prisma.workOrder.findFirst({ where: { id, workshopId: context.workshopId }, include });
    if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
    const actorIds = [...new Set(order.activities.map((activity) => activity.createdById))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const names = new Map(actors.map((actor) => [actor.id, actor.name]));
    return enrichOrder({ ...order, activities: order.activities.map((activity) => ({ ...activity, actorName: names.get(activity.createdById) || null })) });
  },

  async history(context: RequestContext, id: string, page: number, pageSize: number) {
    if (!await prisma.workOrder.findFirst({ where: { id, workshopId: context.workshopId }, select: { id: true } })) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
    const where = { workOrderId: id, OR: [{ workshopId: context.workshopId }, { workshopId: null }] };
    const [items, total] = await prisma.$transaction([prisma.workOrderActivity.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.workOrderActivity.count({ where })]);
    const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(items.map((item) => item.createdById))] } }, select: { id: true, name: true } }); const names = new Map(actors.map((actor) => [actor.id, actor.name]));
    return { items: items.map((item) => ({ ...item, actorName: names.get(item.createdById) || null })), page, pageSize, total, pageCount: Math.ceil(total / pageSize) };
  },

  create(context: RequestContext, input: CreateWorkOrderInput) {
    if (input.services.some((line) => line.discountCents > 0) || input.parts.some((line) => line.discountCents > 0)) requirePermission(context, "APPLY_DISCOUNT");
    return runSerializableTransaction(async (tx) => {
      await assertReferences(context, input.bikeId, input.services, input.parts, tx);
      const bike = await tx.bike.findFirstOrThrow({ where: { id: input.bikeId, workshopId: context.workshopId, active: true, customer: { active: true } }, select: { customerId: true, brand: true, model: true, year: true, type: true, wheelSize: true, frameSize: true, color: true, serialNumber: true, notes: true, customer: { select: { name: true, phone: true, email: true, cpfCnpj: true } } } });
      const number = await takeNextWorkOrderNumber(tx, context.workshopId);
      const computed = totals(input.services, input.parts);
      const rows = await serviceRows(input.services, tx);
      return tx.workOrder.create({ data: { workshopId: context.workshopId, bikeId: input.bikeId, customerSnapshotId: bike.customerId, customerSnapshotData: createCustomerSnapshot(bike.customer), bikeSnapshotData: createBikeSnapshot(bike), number, status: "OPEN", complaint: input.complaint, diagnosis: input.diagnosis, expectedDate: databaseDate(input.expectedDate), expectedNote: input.expectedNote, checklistSnapshot: input.checklist === null ? Prisma.JsonNull : input.checklist, createdById: context.userId, ...computed, services: { create: rows }, parts: { create: partRows(input.parts) }, activities: { create: { type: "CREATED", title: "Ordem de serviço criada", description: "Registrada como aberta.", createdById: context.userId } } }, include });
    });
  },

  update(context: RequestContext, id: string, input: UpdateWorkOrderInput) {
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx); if (!editable.includes(order.status as typeof editable[number])) throw new DomainError("Esta OS não pode mais ser editada.", 409, "WORK_ORDER_LOCKED");
      if (input.version !== order.version) throw new DomainError("Esta OS foi alterada em outra ação. Recarregue os dados antes de salvar novamente.", 409, "STALE_WORK_ORDER");
      const services = input.services ?? order.services.map((line) => ({ serviceCatalogItemId: line.serviceCatalogItemId || undefined, name: line.nameSnapshot, quantity: Number(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, performedById: line.performedById || undefined }));
      const parts = input.parts ?? order.parts.map((line) => ({ inventoryItemId: line.inventoryItemId, name: line.nameSnapshot, quantity: Number(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents }));
      await assertReferences(context, undefined, services, parts, tx); const computed = totals(services, parts);
      const currentServices = order.services.map((line) => ({ serviceCatalogItemId: line.serviceCatalogItemId || undefined, name: line.nameSnapshot, quantity: Number(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, performedById: line.performedById || undefined }));
      const currentParts = order.parts.map((line) => ({ inventoryItemId: line.inventoryItemId, name: line.nameSnapshot, quantity: Number(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents }));
      const servicesChanged = input.services !== undefined && JSON.stringify(services) !== JSON.stringify(currentServices);
      const partsChanged = input.parts !== undefined && JSON.stringify(parts) !== JSON.stringify(currentParts);
      const servicePrices = new Map((await tx.serviceCatalogItem.findMany({ where: { id: { in: services.flatMap((line) => line.serviceCatalogItemId ? [line.serviceCatalogItemId] : []) }, workshopId: context.workshopId }, select: { id: true, priceCents: true } })).map((item) => [item.id, item.priceCents]));
      const partPrices = new Map((await tx.inventoryItem.findMany({ where: { id: { in: parts.map((line) => line.inventoryItemId) }, workshopId: context.workshopId }, select: { id: true, salePriceCents: true } })).map((item) => [item.id, item.salePriceCents]));
      const { pricingChanged, adjustmentsChanged } = workOrderSensitiveChanges(services, currentServices, parts, currentParts, servicePrices, partPrices);
      if (pricingChanged) requirePermission(context, "EDIT_PRICE");
      if (adjustmentsChanged) requirePermission(context, "APPLY_DISCOUNT");
      if ((pricingChanged || adjustmentsChanged) && !input.changeReason) throw new DomainError("Informe o motivo da alteração de preço, desconto ou acréscimo.", 400, "CHANGE_REASON_REQUIRED");
      const checklistChanged = input.checklist !== undefined && JSON.stringify(input.checklist) !== JSON.stringify(order.checklistSnapshot);
      if (servicesChanged) { const rows = await serviceRows(services, tx); await tx.workOrderServiceLine.deleteMany({ where: { workOrderId: id } }); await tx.workOrderServiceLine.createMany({ data: rows.map((line) => ({ ...line, workOrderId: id })) }); }
      if (partsChanged) { await tx.workOrderPartLine.deleteMany({ where: { workOrderId: id } }); await tx.workOrderPartLine.createMany({ data: partRows(parts).map((line) => ({ ...line, workOrderId: id })) }); if (order.reservations.some((reservation) => reservation.status === "ACTIVE")) await reconcileReservations(context, id, order.number, parts, tx); }
      const changes: Array<{ type: "DIAGNOSIS_UPDATED" | "ITEMS_UPDATED" | "CHECKLIST_UPDATED"; title: string; description?: string }> = [];
      if (input.diagnosis !== undefined && input.diagnosis !== order.diagnosis) changes.push({ type: "DIAGNOSIS_UPDATED", title: "Diagnóstico atualizado" });
      if (servicesChanged || partsChanged) changes.push({ type: "ITEMS_UPDATED", title: "Itens da OS atualizados", description: `${services.length} serviço(s) e ${parts.length} peça(s).` });
      if (checklistChanged) changes.push({ type: "CHECKLIST_UPDATED", title: "Checklist atualizado", description: input.checklist ? `${input.checklist.items.filter((item) => item.result).length}/${input.checklist.items.length} itens preenchidos.` : "Checklist removido." });
      if (changes.length) await tx.workOrderActivity.createMany({ data: changes.map((change) => ({ workOrderId: id, createdById: context.userId, ...change })) });
      if (pricingChanged || adjustmentsChanged) await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "ITEMS_UPDATED", title: "Valores da OS alterados", description: input.changeReason, metadata: { before: { services: currentServices, parts: currentParts }, after: { services, parts } }, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { version: { increment: 1 }, diagnosis: input.diagnosis, ...(input.expectedDate !== undefined ? { expectedDate: databaseDate(input.expectedDate) } : {}), ...(input.expectedNote !== undefined ? { expectedNote: input.expectedNote || null } : {}), ...(input.checklist !== undefined ? { checklistSnapshot: input.checklist === null ? Prisma.JsonNull : input.checklist } : {}), ...((servicesChanged || partsChanged) ? { approvalStatus: "PENDING" as const, approvalNote: null, approvalDecidedAt: null, approvalDecidedBy: null } : {}), ...computed }, include });
    });
  },

  assignMechanic(context: RequestContext, id: string, mechanicId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await owned(context, id, tx); if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new DomainError("Esta OS está encerrada.", 409, "WORK_ORDER_LOCKED");
      const mechanic = await tx.workshopMember.findFirst({ where: { id: mechanicId, workshopId: context.workshopId, active: true, role: { in: ["OWNER", "MANAGER", "MECHANIC"] } }, include: { user: { select: { name: true } } } });
      if (!mechanic) throw new DomainError("Mecânico ativo não encontrado nesta oficina.", 400, "INVALID_MECHANIC");
      const mechanicName = mechanic.user.name;
      await tx.workOrderActivity.create({ data: { workOrderId: id, type: "MECHANIC_ASSIGNED", title: "Mecânico atribuído", description: mechanicName, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { assignedMechanicId: mechanic.id, assignedMechanicName: mechanicName }, include });
    });
  },

  decideQuote(context: RequestContext, id: string, decision: "APPROVED" | "REJECTED", details: { note?: string; channel: "IN_PERSON" | "WHATSAPP" | "PHONE" | "EMAIL" | "OTHER"; approvedByName?: string; evidence?: string; validUntil?: string | null }) {
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx); if (!["OPEN", "IN_PROGRESS"].includes(order.status)) throw new DomainError("O orçamento só pode ser decidido enquanto a OS está aberta ou em serviço.", 409, "INVALID_QUOTE_STATE");
      if (decision === "APPROVED" && !order.services.length && !order.parts.length) throw new DomainError("Adicione serviços ou peças antes de aprovar o orçamento.", 400, "EMPTY_QUOTE");
      const latest = await tx.workOrderQuote.aggregate({ where: { workOrderId: id }, _max: { version: true } });
      const quote = await tx.workOrderQuote.create({ data: { workOrderId: id, version: (latest._max.version || 0) + 1, sourceWorkOrderVersion: order.version, status: decision, validUntil: databaseDate(details.validUntil), subtotalCents: order.totalCents, totalCents: order.totalCents, serviceSnapshot: order.services.map((line) => ({ description: line.nameSnapshot, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: line.totalCents })), partSnapshot: order.parts.map((line) => ({ description: line.nameSnapshot, quantity: String(line.quantity), unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, surchargeCents: line.surchargeCents, totalCents: line.totalCents })), createdById: context.userId, approvals: { create: { channel: details.channel, decision, approvedByName: details.approvedByName, evidence: details.evidence, notes: details.note, recordedById: context.userId } } } });
      await tx.workOrderServiceLine.updateMany({ where: { workOrderId: id }, data: { status: decision === "APPROVED" ? "APPROVED" : "REJECTED" } });
      await tx.workOrderPartLine.updateMany({ where: { workOrderId: id }, data: { status: decision === "APPROVED" ? "APPROVED" : "REJECTED" } });
      order.services.forEach((line) => { line.status = decision === "APPROVED" ? "APPROVED" : "REJECTED"; });
      order.parts.forEach((line) => { line.status = decision === "APPROVED" ? "APPROVED" : "REJECTED"; });
      if (decision === "APPROVED" && order.workshop.reservationPolicy === "ON_QUOTE_APPROVAL") await reserveOrderParts(context, order, tx);
      if (decision === "REJECTED") await releaseReservations(context, order.id, tx, "Orçamento recusado");
      await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: decision === "APPROVED" ? "QUOTE_APPROVED" : "QUOTE_REJECTED", title: decision === "APPROVED" ? "Orçamento aprovado" : "Orçamento recusado", description: details.note || (decision === "APPROVED" ? `Versão ${quote.version}, valor R$ ${(order.totalCents / 100).toFixed(2).replace(".", ",")}.` : "Cliente não aprovou o orçamento."), metadata: { quoteId: quote.id, version: quote.version, channel: details.channel }, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { approvalStatus: decision, approvalNote: details.note, approvalDecidedAt: new Date(), approvalDecidedBy: context.userId }, include });
    });
  },

  registerContact(context: RequestContext, id: string, message: string) {
    return prisma.$transaction(async (tx) => {
      await owned(context, id, tx);
      await tx.workOrderCommunication.create({ data: { workshopId: context.workshopId, workOrderId: id, channel: "WHATSAPP", status: "LINK_OPENED", messageSnapshot: message, createdById: context.userId } });
      await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "CUSTOMER_CONTACTED", title: "Link do WhatsApp aberto", description: "A abertura não confirma o envio da mensagem.", metadata: { channel: "WHATSAPP", status: "LINK_OPENED" }, createdById: context.userId } });
      return owned(context, id, tx);
    });
  },

  cancel(context: RequestContext, id: string, reason: string) {
    requirePermission(context, "CANCEL_WORK_ORDER");
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (order.status === "CANCELLED") return order;
      if (order.status === "COMPLETED") throw new DomainError("Uma OS concluída não pode ser cancelada.", 409, "INVALID_TRANSITION");
      await releaseReservations(context, order.id, tx, "OS cancelada");
      if (order.status === "READY" && order.stockConsumed) await reverseOutstandingStock(context, order, tx, `Cancelamento da OS #${order.number}`);
      await tx.workOrderActivity.create({ data: { workOrderId: id, type: "CANCELLED", title: "Ordem de serviço cancelada", description: reason, metadata: { previousStatus: order.status }, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), stockConsumed: false, version: { increment: 1 } }, include });
    });
  },

  complete(context: RequestContext, id: string, input: { pickedUpByName: string; documentNumber?: string; relationship?: string; notes?: string; accepted: true; paymentStatus: "PENDING" | "PAID" | "WAIVED" }) {
    requirePermission(context, "COMPLETE_WORK_ORDER");
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (order.status !== "READY") throw new DomainError("A OS precisa estar pronta.", 409, "INVALID_TRANSITION");
      if (order.workshop.requirePaymentBeforeCompletion && !["PAID", "WAIVED"].includes(input.paymentStatus)) throw new DomainError("Confirme o pagamento antes de concluir.", 409, "PAYMENT_REQUIRED");
      await tx.workOrderPickup.create({ data: { workOrderId: id, pickedUpByName: input.pickedUpByName, documentNumber: input.documentNumber, relationship: input.relationship, notes: input.notes, accepted: input.accepted, recordedById: context.userId } });
      const now = new Date();
      const warranties = order.services.filter((line) => line.warrantyDaysSnapshot && line.warrantyDaysSnapshot > 0).map((line) => ({ workOrderId: id, serviceLineId: line.id, descriptionSnapshot: line.nameSnapshot, warrantyDays: line.warrantyDaysSnapshot as number, startsAt: now, expiresAt: new Date(now.getTime() + (line.warrantyDaysSnapshot as number) * 86_400_000) }));
      if (warranties.length) await tx.workOrderWarranty.createMany({ data: warranties });
      await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "STATUS_CHANGED", title: "Retirada concluída", description: `Retirado por ${input.pickedUpByName}.`, metadata: { paymentStatus: input.paymentStatus, accepted: true }, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { status: "COMPLETED", completedAt: now, paymentStatus: input.paymentStatus }, include });
    });
  },

  reopenCompleted(context: RequestContext, id: string, reason: string) {
    requirePermission(context, "REOPEN_COMPLETED_ORDER");
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (order.status !== "COMPLETED" || !order.stockConsumed) throw new DomainError("A OS precisa estar concluída com estoque consumido.", 409, "INVALID_TRANSITION");
      await reverseOutstandingStock(context, order, tx, `Reabertura pós-entrega da OS #${order.number}: ${reason}`);
      await reserveOrderParts(context, order, tx);
      await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "STATUS_CHANGED", title: "OS reaberta pós-entrega", description: reason, metadata: { previousCompletedAt: order.completedAt, pickupPreserved: true }, createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { status: "IN_PROGRESS", readyAt: null, completedAt: null, stockConsumed: false, version: { increment: 1 } }, include });
    });
  },

  transition(context: RequestContext, id: string, action: "start" | "ready" | "reopen" | "complete") {
    return runSerializableTransaction(async (tx) => {
      const order = await owned(context, id, tx);
      if (action === "start") {
        if (!canRunWorkOrderCommand(order.status, "start")) throw new DomainError("A OS não pode iniciar neste estado.", 409, "INVALID_TRANSITION");
        const blockers = blockingPendingsFor("start", { status: order.status, approvalStatus: order.approvalStatus, assignedMechanicId: order.assignedMechanicId, diagnosis: order.diagnosis, services: order.services, checklists: order.checklists });
        if (blockers.length) throw new DomainError(blockers.map((item) => item.message).join(" "), 409, blockers[0].code);
        if (order.workshop.reservationPolicy === "ON_WORK_ORDER_START") await reserveOrderParts(context, order, tx);
        const now = new Date();
        if (order.assignedMechanicId) await tx.workOrderWorkSession.create({ data: { workOrderId: id, mechanicMemberId: order.assignedMechanicId, createdById: context.userId, startedAt: now } });
        await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "STATUS_CHANGED", title: "Execução iniciada", description: "Status alterado de aberta para em serviço.", createdById: context.userId } });
        return tx.workOrder.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: now, executionPausedAt: null, version: { increment: 1 } }, include });
      }
      if (action === "complete") { requirePermission(context, "COMPLETE_WORK_ORDER"); if (order.status !== "READY") throw new DomainError("A OS precisa estar pronta.", 409, "INVALID_TRANSITION"); if (order.workshop.requirePaymentBeforeCompletion && order.paymentStatus !== "PAID" && order.paymentStatus !== "WAIVED") throw new DomainError("Confirme o pagamento antes de concluir.", 409, "PAYMENT_REQUIRED"); await tx.workOrderActivity.create({ data: { workOrderId: id, workshopId: context.workshopId, actorMemberId: context.memberId, type: "STATUS_CHANGED", title: "Retirada concluída", description: "Ordem de serviço finalizada.", createdById: context.userId } }); return tx.workOrder.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() }, include }); }
      if (action === "ready") {
        if (order.status === "READY" && order.stockConsumed) return order;
        if (!canRunWorkOrderCommand(order.status, "ready")) throw new DomainError("A OS precisa estar em serviço.", 409, "INVALID_TRANSITION");
        if (order.executionPausedAt) throw new DomainError("Retome a execução antes de marcar a OS como pronta.", 409, "EXECUTION_PAUSED");
        const blockers = blockingPendingsFor("ready", { status: order.status, approvalStatus: order.approvalStatus, assignedMechanicId: order.assignedMechanicId, diagnosis: order.diagnosis, services: order.services, checklists: order.checklists });
        if (blockers.length) throw new DomainError(`Não é possível marcar a OS como pronta: ${blockers.map((item) => item.message).join(" ")}`, 409, "WORK_ORDER_HAS_BLOCKERS");
        if (!order.services.length && !order.parts.length) throw new DomainError("Adicione ao menos um serviço ou peça.", 400, "EMPTY_WORK_ORDER");
        let activeReservations = await tx.inventoryReservation.findMany({ where: { workshopId: context.workshopId, workOrderId: id, status: "ACTIVE" } });
        if (order.parts.length && !activeReservations.length) { await reserveOrderParts(context, order, tx); activeReservations = await tx.inventoryReservation.findMany({ where: { workshopId: context.workshopId, workOrderId: id, status: "ACTIVE" } }); }
        const grouped = new Map<string, Prisma.Decimal>(); for (const line of order.parts.filter((item) => item.status === "APPROVED")) grouped.set(line.inventoryItemId, (grouped.get(line.inventoryItemId) || new Prisma.Decimal(0)).plus(line.quantity));
        for (const [inventoryItemId, qty] of grouped) { const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, workshopId: context.workshopId, active: true } }); const reserved = activeReservations.filter((item) => item.inventoryItemId === inventoryItemId).reduce((sum, item) => sum.plus(item.quantity), new Prisma.Decimal(0)); if (!item || item.quantity.lessThan(qty) || reserved.lessThan(qty)) throw new DomainError(`Estoque/reserva insuficiente: necessário ${qty}, físico ${item?.quantity || 0}, reservado ${reserved}.`, 409, "INSUFFICIENT_STOCK"); }
        for (const [inventoryItemId, qty] of grouped) { const before = await tx.inventoryItem.findFirstOrThrow({ where: { id: inventoryItemId, workshopId: context.workshopId } }); const after = await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { quantity: { decrement: qty }, reservedQuantity: { decrement: qty } } }); await tx.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId, workOrderId: id, type: "WORK_ORDER_USE", quantityDelta: qty.negated(), reason: `Consumo da OS #${order.number}`, originDestination: `OS #${order.number}`, physicalBefore: before.quantity, physicalAfter: after.quantity, reservedBefore: before.reservedQuantity, reservedAfter: after.reservedQuantity, createdById: context.userId } }); }
        if (activeReservations.length) await tx.inventoryReservation.updateMany({ where: { id: { in: activeReservations.map((item) => item.id) } }, data: { status: "CONSUMED", releasedById: context.userId, releaseReason: "Consumida ao marcar READY" } });
        await tx.workOrderWorkSession.updateMany({ where: { workOrderId: id, status: "ACTIVE" }, data: { status: "COMPLETED", endedAt: new Date() } });
        await tx.workOrderActivity.create({ data: { workOrderId: id, type: "STOCK_CONSUMED", title: "OS marcada como pronta", description: grouped.size ? `Estoque baixado para ${grouped.size} item(ns).` : "Nenhuma peça para baixar.", createdById: context.userId } });
        return tx.workOrder.update({ where: { id }, data: { status: "READY", readyAt: new Date(), stockConsumed: true }, include });
      }
      if (order.status !== "READY" || !order.stockConsumed) throw new DomainError("A OS precisa estar pronta.", 409, "INVALID_TRANSITION");
      await reverseOutstandingStock(context, order, tx, `Reabertura da OS #${order.number}`);
      await reserveOrderParts(context, order, tx);
      await tx.workOrderActivity.create({ data: { workOrderId: id, type: "STOCK_REVERSED", title: "OS reaberta", description: "Status voltou para em serviço e as peças pendentes foram devolvidas.", createdById: context.userId } });
      return tx.workOrder.update({ where: { id }, data: { status: "IN_PROGRESS", readyAt: null, stockConsumed: false }, include });
    });
  },
};
