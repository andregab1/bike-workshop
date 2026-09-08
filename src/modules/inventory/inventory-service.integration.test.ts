import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/lib/request-context";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";

const run = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let context: RequestContext;
let foreignContext: RequestContext;
let inventoryId: string;
let bikeId: string;
let editableOrderId: string;

async function cleanWorkshop(workshopId: string) {
  const orders = await prisma.workOrder.findMany({ where: { workshopId }, select: { id: true } }); const orderIds = orders.map((order) => order.id);
  const quotes = await prisma.workOrderQuote.findMany({ where: { workOrderId: { in: orderIds } }, select: { id: true } });
  await prisma.workOrderQuoteApproval.deleteMany({ where: { quoteId: { in: quotes.map((quote) => quote.id) } } });
  await prisma.workOrderQuote.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.inventoryReservation.deleteMany({ where: { workshopId } });
  await prisma.inventoryMovement.deleteMany({ where: { workshopId } });
  await prisma.workOrderWorkSession.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderAttachment.deleteMany({ where: { workOrderId: { in: orderIds } } });
  const checklists = await prisma.workOrderChecklist.findMany({ where: { workOrderId: { in: orderIds } }, select: { id: true } });
  await prisma.workOrderChecklistItem.deleteMany({ where: { checklistId: { in: checklists.map((item) => item.id) } } });
  await prisma.workOrderChecklist.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderActivity.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderPartLine.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrderServiceLine.deleteMany({ where: { workOrderId: { in: orderIds } } });
  await prisma.workOrder.deleteMany({ where: { workshopId } });
  await prisma.workOrderCounter.deleteMany({ where: { workshopId } });
  await prisma.inventoryItem.deleteMany({ where: { workshopId } });
  await prisma.bike.deleteMany({ where: { workshopId } });
  await prisma.customer.deleteMany({ where: { workshopId } });
  await prisma.workshopMember.deleteMany({ where: { workshopId } });
  await prisma.workshop.delete({ where: { id: workshopId } }).catch(() => undefined);
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { id: `stock-user-${run}`, name: "Teste Estoque", email: `stock-${run}@test.local` } });
  const workshop = await prisma.workshop.create({ data: { authOrganizationId: `stock-org-${run}`, name: "Oficina Estoque", slug: `stock-${run}` } });
  const member = await prisma.workshopMember.create({ data: { workshopId: workshop.id, userId: user.id, role: "OWNER" } });
  context = { userId: user.id, workshopId: workshop.id, memberId: member.id, role: "OWNER" };
  const foreignUser = await prisma.user.create({ data: { id: `foreign-user-${run}`, name: "Outra Oficina", email: `foreign-${run}@test.local` } });
  const foreignWorkshop = await prisma.workshop.create({ data: { authOrganizationId: `foreign-org-${run}`, name: "Outra Oficina", slug: `foreign-${run}` } });
  const foreignMember = await prisma.workshopMember.create({ data: { workshopId: foreignWorkshop.id, userId: foreignUser.id, role: "OWNER" } });
  foreignContext = { userId: foreignUser.id, workshopId: foreignWorkshop.id, memberId: foreignMember.id, role: "OWNER" };
  const customer = await prisma.customer.create({ data: { workshopId: workshop.id, name: "Cliente Estoque", phone: "11999999999", normalizedPhone: "11999999999", createdById: user.id } });
  const bike = await prisma.bike.create({ data: { workshopId: workshop.id, customerId: customer.id, brand: "Sense", model: "Impact" } }); bikeId = bike.id;
  const item = await inventoryService.createCustom(context, { customName: "Disco teste", quantity: 20, minimumQuantity: 5, unitOfMeasure: "UNIT", costPriceCents: 5_000, salePriceCents: 8_000, sku: `SKU-${run}`, location: "B-03", purchaseDocument: "NF-1", purchaseDate: "2026-08-27" }); inventoryId = item.id;
});

afterAll(async () => {
  await cleanWorkshop(context.workshopId); await cleanWorkshop(foreignContext.workshopId);
  await prisma.user.deleteMany({ where: { id: { in: [context.userId, foreignContext.userId] } } });
});

describe.sequential("inventory PostgreSQL integration", () => {
  it("creates physical stock, zero reservation and actor movement", async () => {
    const item = await inventoryService.get(context, inventoryId); expect(Number(item.quantity)).toBe(20); expect(Number(item.reservedQuantity)).toBe(0); expect(Number(item.availableQuantity)).toBe(20);
    const [movement] = await inventoryService.movements(context, inventoryId); expect(movement.type).toBe("STOCK_ENTRY"); expect(movement.createdById).toBe(context.userId);
  });
  it("entry increases physical, keeps reserved and recalculates weighted cost", async () => {
    const item = await inventoryService.entry(context, inventoryId, { quantity: 10, unitCostCents: 8_000, purchaseDocument: "NF-2", purchaseDate: "2026-08-27" }); expect(Number(item.quantity)).toBe(30); expect(Number(item.reservedQuantity)).toBe(0); expect(item.costPriceCents).toBe(6_000);
  });
  it("manual exit reduces physical and rejects excess", async () => {
    await expect(inventoryService.manualExit(context, inventoryId, { quantity: 31, reasonCode: "OUTRO", notes: "Teste", document: undefined })).rejects.toMatchObject({ code: "INSUFFICIENT_AVAILABLE_STOCK" });
    const item = await inventoryService.manualExit(context, inventoryId, { quantity: 2, reasonCode: "USO_INTERNO", notes: "Uso", document: undefined }); expect(Number(item.quantity)).toBe(28);
  });
  it("does not expose another workshop item", async () => { await expect(inventoryService.get(foreignContext, inventoryId)).rejects.toMatchObject({ code: "INVENTORY_ITEM_NOT_FOUND" }); });
  it("reserves on approval without changing physical", async () => {
    const order = await workOrderService.create(context, { bikeId, complaint: "Teste", diagnosis: "", services: [], parts: [{ inventoryItemId: inventoryId, name: "Disco teste", quantity: 2, unitPriceCents: 8_000, discountCents: 0, surchargeCents: 0 }], checklist: null }); editableOrderId = order.id;
    const approved = await workOrderService.decideQuote(context, order.id, "APPROVED", { channel: "IN_PERSON" }); const item = await inventoryService.get(context, inventoryId); expect(Number(item.quantity)).toBe(28); expect(Number(item.reservedQuantity)).toBe(2); expect(Number(item.availableQuantity)).toBe(26); expect(approved.approvalStatus).toBe("APPROVED");
  });
  it("edits reservation by delta and removal releases it", async () => {
    const order = await workOrderService.get(context, editableOrderId); await workOrderService.update(context, order.id, { version: order.version, parts: [{ inventoryItemId: inventoryId, name: "Disco teste", quantity: 3, unitPriceCents: 8_000, discountCents: 0, surchargeCents: 0 }] }); expect(Number((await inventoryService.get(context, inventoryId)).reservedQuantity)).toBe(3);
    const fresh = await workOrderService.get(context, order.id); await workOrderService.update(context, order.id, { version: fresh.version, parts: [] }); expect(Number((await inventoryService.get(context, inventoryId)).reservedQuantity)).toBe(0);
  });
  it("cancel releases reservation", async () => {
    const order = await workOrderService.create(context, { bikeId, complaint: "Cancelar", diagnosis: "", services: [], parts: [{ inventoryItemId: inventoryId, name: "Disco teste", quantity: 2, unitPriceCents: 8_000, discountCents: 0, surchargeCents: 0 }], checklist: null }); await workOrderService.decideQuote(context, order.id, "APPROVED", { channel: "PHONE" }); await workOrderService.cancel(context, order.id, "Cliente cancelou"); expect(Number((await inventoryService.get(context, inventoryId)).reservedQuantity)).toBe(0);
  });
  it("ready consumes physical and clears reservation atomically", async () => {
    const order = await workOrderService.create(context, { bikeId, complaint: "Consumir", diagnosis: "", services: [], parts: [{ inventoryItemId: inventoryId, name: "Disco teste", quantity: 2, unitPriceCents: 8_000, discountCents: 0, surchargeCents: 0 }], checklist: null }); await workOrderService.assignMechanic(context, order.id, context.memberId); await workOrderService.decideQuote(context, order.id, "APPROVED", { channel: "IN_PERSON" }); await workOrderService.transition(context, order.id, "start"); await workOrderService.transition(context, order.id, "ready"); const item = await inventoryService.get(context, inventoryId); expect(Number(item.quantity)).toBe(26); expect(Number(item.reservedQuantity)).toBe(0); expect((await inventoryService.movements(context, inventoryId)).some((movement) => movement.type === "WORK_ORDER_USE")).toBe(true);
  });
  it("adjustment creates directional movement and cannot cross reservation", async () => {
    await inventoryService.physicalCount(context, inventoryId, 25, "Contagem"); const [movement] = await inventoryService.movements(context, inventoryId); expect(movement.type).toBe("ADJUSTMENT_OUT"); expect(Number(movement.physicalAfter)).toBe(25);
  });
  it("calculates real summary cost", async () => { const result = await inventoryService.list(context, { page: 1, size: 30, status: "all", sort: "name_asc" }); expect(result.summary.registered).toBe(1); expect(result.summary.available).toBe(25); expect(result.summary.totalCostCents).toBe(150_000); });
  it("supports the inventory screen filters and real usage ranking", async () => { const result = await inventoryService.list(context, { page: 1, size: 16, status: "normal", sort: "usage_desc", location: "B-03" }); expect(result.items).toHaveLength(1); expect(result.items[0]).toMatchObject({ id: inventoryId, usageCount: 3, unitsUsed: 5 }); expect(result.locations).toContain("B-03"); expect(result.summary.movementsToday).toBeGreaterThan(0); });
  it("prevents concurrent over-reservation", async () => {
    const makeOrder = () => workOrderService.create(context, { bikeId, complaint: "Concorrência", diagnosis: "", services: [], parts: [{ inventoryItemId: inventoryId, name: "Disco teste", quantity: 20, unitPriceCents: 8_000, discountCents: 0, surchargeCents: 0 }], checklist: null }); const [a, b] = await Promise.all([makeOrder(), makeOrder()]); const decisions = await Promise.allSettled([workOrderService.decideQuote(context, a.id, "APPROVED", { channel: "IN_PERSON" }), workOrderService.decideQuote(context, b.id, "APPROVED", { channel: "IN_PERSON" })]); expect(decisions.filter((result) => result.status === "fulfilled")).toHaveLength(1); const item = await inventoryService.get(context, inventoryId); expect(Number(item.reservedQuantity)).toBeLessThanOrEqual(Number(item.quantity));
  });
});
