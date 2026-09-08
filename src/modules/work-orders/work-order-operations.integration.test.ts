import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/lib/request-context";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { workOrderItemService } from "@/modules/work-orders/services/work-order-item-service";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { workOrderQuoteService } from "@/modules/work-orders/services/work-order-quote-service";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";

const run = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let context: RequestContext;
let foreignContext: RequestContext;
let bikeId = "";
let inventoryItemId = "";
let serviceCatalogItemId = "";
let checklistTemplateId = "";
let orderId = "";

async function cleanup(workshopId: string) {
  const orders = await prisma.workOrder.findMany({ where: { workshopId }, select: { id: true } }); const orderIds = orders.map((item) => item.id);
  const quotes = await prisma.workOrderQuote.findMany({ where: { workOrderId: { in: orderIds } }, select: { id: true } });
  const checklists = await prisma.workOrderChecklist.findMany({ where: { workOrderId: { in: orderIds } }, select: { id: true } });
  await prisma.workOrderQuoteApproval.deleteMany({ where: { quoteId: { in: quotes.map((item) => item.id) } } });
  await prisma.workOrderQuote.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderChecklistItem.deleteMany({ where: { checklistId: { in: checklists.map((item) => item.id) } } });
  await prisma.workOrderChecklist.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderWorkSession.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderAttachment.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderWarranty.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderPickup.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.inventoryReservation.deleteMany({ where: { workshopId } });
  await prisma.inventoryMovement.deleteMany({ where: { workshopId } });
  await prisma.workOrderActivity.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderPartLine.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderServiceLine.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrder.deleteMany({ where: { workshopId } });
  await prisma.workOrderCounter.deleteMany({ where: { workshopId } });
  await prisma.checklistTemplateItem.deleteMany({ where: { template: { workshopId } } });
  await prisma.checklistTemplate.deleteMany({ where: { workshopId } });
  await prisma.serviceCatalogItem.deleteMany({ where: { workshopId } });
  await prisma.inventoryItem.deleteMany({ where: { workshopId } });
  await prisma.bike.deleteMany({ where: { workshopId } });
  await prisma.customer.deleteMany({ where: { workshopId } });
  await prisma.workshopMember.deleteMany({ where: { workshopId } });
  await prisma.workshop.delete({ where: { id: workshopId } }).catch(() => undefined);
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { id: `wo-user-${run}`, name: "Operador QA", email: `wo-${run}@test.local` } });
  const workshop = await prisma.workshop.create({ data: { authOrganizationId: `wo-org-${run}`, name: "Oficina OS", slug: `wo-${run}` } });
  const member = await prisma.workshopMember.create({ data: { workshopId: workshop.id, userId: user.id, role: "OWNER" } });
  context = { userId: user.id, workshopId: workshop.id, memberId: member.id, role: "OWNER" };
  const customer = await prisma.customer.create({ data: { workshopId: workshop.id, name: "Ana Teste", phone: "41988124410", normalizedPhone: "41988124410", createdById: user.id } });
  bikeId = (await prisma.bike.create({ data: { workshopId: workshop.id, customerId: customer.id, brand: "Sense", model: "Impact Pro", type: "MTB", wheelSize: "29" } })).id;
  serviceCatalogItemId = (await prisma.serviceCatalogItem.create({ data: { workshopId: workshop.id, name: "Troca de disco", priceCents: 9_000, warrantyDays: 30 } })).id;
  inventoryItemId = (await inventoryService.createCustom(context, { customName: "Disco Shimano", quantity: 3, minimumQuantity: 1, unitOfMeasure: "UNIT", costPriceCents: 4_000, salePriceCents: 7_490, purchaseDocument: "NF-OS", purchaseDate: "2026-08-27" })).id;
  checklistTemplateId = (await prisma.checklistTemplate.create({ data: { workshopId: workshop.id, name: "Checklist técnico", items: { create: [{ label: "Freios", sortOrder: 0 }, { label: "Direção", sortOrder: 1 }] } } })).id;
  const foreignUser = await prisma.user.create({ data: { id: `wo-foreign-${run}`, name: "Outra oficina", email: `wo-foreign-${run}@test.local` } });
  const foreignWorkshop = await prisma.workshop.create({ data: { authOrganizationId: `wo-foreign-org-${run}`, name: "Outra", slug: `wo-foreign-${run}` } });
  const foreignMember = await prisma.workshopMember.create({ data: { workshopId: foreignWorkshop.id, userId: foreignUser.id, role: "OWNER" } });
  foreignContext = { userId: foreignUser.id, workshopId: foreignWorkshop.id, memberId: foreignMember.id, role: "OWNER" };
});

afterAll(async () => {
  await cleanup(context.workshopId); await cleanup(foreignContext.workshopId);
  await prisma.user.deleteMany({ where: { id: { in: [context.userId, foreignContext.userId] } } });
});

describe.sequential("professional work order operations", () => {
  it("creates OS and adds catalog-priced items through explicit commands", async () => {
    const order = await workOrderService.create(context, { bikeId, complaint: "Freio traseiro fraco.", diagnosis: "", services: [], parts: [], checklist: null }); orderId = order.id;
    const service = await workOrderItemService.addService(context, orderId, { serviceCatalogItemId, quantity: 1 });
    const part = await workOrderItemService.addPart(context, orderId, { inventoryItemId, quantity: 1 });
    expect(service.unitPriceCents).toBe(9_000); expect(part.unitPriceCents).toBe(7_490);
    expect((await workOrderService.get(context, orderId)).totalCents).toBe(16_490);
  });

  it("edits quantity and discount with server totals and audit", async () => {
    const detail = await workOrderService.get(context, orderId);
    await workOrderItemService.updateService(context, orderId, detail.services[0].id, { quantity: 2, discountCents: 1_000, reason: "Desconto autorizado" });
    await workOrderItemService.updatePart(context, orderId, detail.parts[0].id, { quantity: 2, discountCents: 490, reason: "Condição comercial" });
    const updated = await workOrderService.get(context, orderId);
    expect(updated.services[0].totalCents).toBe(17_000); expect(updated.parts[0].totalCents).toBe(14_490); expect(updated.totalCents).toBe(31_490);
    expect(updated.activities.filter((activity) => activity.title.includes("atualizad")).length).toBeGreaterThanOrEqual(2);
  });

  it("generates idempotent version, sends and approves atomically with reservation", async () => {
    const first = await workOrderQuoteService.generate(context, orderId, { kind: "BASE" });
    const repeated = await workOrderQuoteService.generate(context, orderId, { kind: "BASE" }); expect(repeated.id).toBe(first.id);
    await workOrderQuoteService.send(context, orderId, first.id);
    await workOrderQuoteService.decide(context, orderId, first.id, "APPROVED", { channel: "IN_PERSON", approvedByName: "Ana Teste" });
    const inventory = await inventoryService.get(context, inventoryItemId); expect(Number(inventory.quantity)).toBe(3); expect(Number(inventory.reservedQuantity)).toBe(2);
  });

  it("blocks READY until approved service and required checklist are complete", async () => {
    await workOrderService.assignMechanic(context, orderId, context.memberId);
    await workOrderService.transition(context, orderId, "start");
    await expect(workOrderService.transition(context, orderId, "ready")).rejects.toMatchObject({ code: "WORK_ORDER_HAS_BLOCKERS" });
    const detail = await workOrderService.get(context, orderId); await workOrderOperationService.updateServiceStatus(context, orderId, detail.services[0].id, "COMPLETED");
    const checklist = await workOrderOperationService.applyChecklist(context, orderId, { templateId: checklistTemplateId, type: "TECHNICAL", required: true });
    await expect(workOrderService.transition(context, orderId, "ready")).rejects.toMatchObject({ code: "WORK_ORDER_HAS_BLOCKERS" });
    for (const item of checklist.items) await workOrderOperationService.updateChecklistItem(context, orderId, item.id, { result: "OK" });
    const ready = await workOrderService.transition(context, orderId, "ready"); expect(ready.status).toBe("READY");
    const inventory = await inventoryService.get(context, inventoryItemId); expect(Number(inventory.quantity)).toBe(1); expect(Number(inventory.reservedQuantity)).toBe(0);
  });

  it("delivers once and exposes friendly timeline without cross-tenant access", async () => {
    const completed = await workOrderService.complete(context, orderId, { pickedUpByName: "Ana Teste", accepted: true, paymentStatus: "PAID" }); expect(completed.status).toBe("COMPLETED");
    await expect(workOrderService.complete(context, orderId, { pickedUpByName: "Ana Teste", accepted: true, paymentStatus: "PAID" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const detail = await workOrderService.get(context, orderId); expect(detail.activities.some((activity) => activity.actorName === "Operador QA")).toBe(true);
    await expect(workOrderService.get(foreignContext, orderId)).rejects.toMatchObject({ code: "WORK_ORDER_NOT_FOUND" });
  });
});
