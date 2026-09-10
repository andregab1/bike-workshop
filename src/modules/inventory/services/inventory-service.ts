import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { weightedAverageCost } from "@/modules/inventory/inventory-policy";
import type { CreateCatalogInventoryItemInput, CreateCustomInventoryItemInput, ManualExitInput } from "@/modules/inventory/schemas/inventory";
import type { z } from "zod";
import { inventoryListQuerySchema } from "@/modules/inventory/schemas/inventory";
import { requirePermission } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

const itemInclude = { catalogPart: { include: { brand: true, category: true } }, brand: true, category: true };
type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

type StockEntryDetails = {
  quantity: number;
  unitCostCents?: number;
  salePriceCents?: number;
  supplierName?: string;
  purchaseDocument?: string;
  purchaseDate?: string;
  reason?: string;
};

async function findOwned(
  context: RequestContext,
  id: string,
  transaction: Pick<typeof prisma, "inventoryItem"> = prisma,
) {
  const item = await transaction.inventoryItem.findFirst({ where: { id, workshopId: context.workshopId, active: true }, include: itemInclude });
  if (!item) throw new DomainError("Peça de estoque não encontrada.", 404, "INVENTORY_ITEM_NOT_FOUND");
  return item;
}

async function assertActiveBrand(brandId: string | undefined, transaction: Pick<typeof prisma, "brand">) {
  if (!brandId) return;
  if (!await transaction.brand.findFirst({ where: { id: brandId, active: true }, select: { id: true } })) {
  throw new DomainError("Marca não encontrada.", 400, "INVALID_BRAND");
  }
}

async function applyEntry(context: RequestContext, id: string, details: StockEntryDetails, transaction: Prisma.TransactionClient) {
  const item = await findOwned(context, id, transaction);
  const quantity = new Prisma.Decimal(details.quantity);
  const costPriceCents = weightedAverageCost(item.quantity, item.costPriceCents, quantity, details.unitCostCents);
  const updated = await transaction.inventoryItem.update({
    where: { id: item.id },
    data: { quantity: { increment: quantity }, ...(costPriceCents !== undefined ? { costPriceCents } : {}), ...(details.salePriceCents !== undefined ? { salePriceCents: details.salePriceCents } : {}), ...(details.supplierName !== undefined ? { supplierName: details.supplierName } : {}), version: { increment: 1 } },
    include: itemInclude,
  });
  await transaction.inventoryMovement.create({
    data: {
      workshopId: context.workshopId,
      inventoryItemId: item.id,
      type: "STOCK_ENTRY",
      quantityDelta: quantity,
      unitCostCents: details.unitCostCents,
      supplierName: details.supplierName,
      purchaseDocument: details.purchaseDocument,
      purchaseDate: details.purchaseDate ? new Date(`${details.purchaseDate}T00:00:00.000Z`) : undefined,
      reason: details.reason,
      originDestination: details.supplierName || "Entrada de estoque",
      physicalBefore: item.quantity,
      physicalAfter: updated.quantity,
      reservedBefore: item.reservedQuantity,
      reservedAfter: updated.reservedQuantity,
      createdById: context.userId,
    },
  });
  return updated;
}

export const inventoryService = {
  async list(context: RequestContext, query: InventoryListQuery) {
    const term = query.search ? `%${query.search}%` : null;
    const status = query.status === "low" ? Prisma.sql`AND (i.quantity - i."reservedQuantity") > 0 AND (i.quantity - i."reservedQuantity") <= i."minimumQuantity"`
      : query.status === "zero" ? Prisma.sql`AND (i.quantity - i."reservedQuantity") = 0`
      : query.status === "normal" ? Prisma.sql`AND (i.quantity - i."reservedQuantity") > i."minimumQuantity"`
      : query.status === "reorder" ? Prisma.sql`AND (i.quantity - i."reservedQuantity") <= i."minimumQuantity"`
      : query.status === "reserved" ? Prisma.sql`AND i."reservedQuantity" > 0` : Prisma.empty;
    const search = term ? Prisma.sql`AND (COALESCE(i."customName", cp.name) ILIKE ${term} OR i.sku ILIKE ${term} OR i.ean ILIKE ${term} OR i.location ILIKE ${term} OR i."supplierName" ILIKE ${term} OR b.name ILIKE ${term} OR c.name ILIKE ${term} OR cp."searchText" ILIKE ${term})` : Prisma.empty;
    const category = query.categoryId ? Prisma.sql`AND i."categoryId" = ${query.categoryId}` : Prisma.empty;
    const brand = query.brandId ? Prisma.sql`AND i."brandId" = ${query.brandId}` : Prisma.empty;
    const location = query.location ? Prisma.sql`AND i.location = ${query.location}` : Prisma.empty;
    const order = query.sort === "stock_asc" ? Prisma.sql`(i.quantity - i."reservedQuantity") ASC`
      : query.sort === "stock_desc" ? Prisma.sql`(i.quantity - i."reservedQuantity") DESC`
      : query.sort === "name_desc" ? Prisma.sql`COALESCE(i."customName", cp.name) DESC`
      : query.sort === "price_asc" ? Prisma.sql`i."salePriceCents" ASC`
      : query.sort === "price_desc" ? Prisma.sql`i."salePriceCents" DESC`
      : query.sort === "movement_desc" ? Prisma.sql`(SELECT MAX(m."createdAt") FROM "inventory_movements" m WHERE m."inventoryItemId" = i.id) DESC NULLS LAST`
      : query.sort === "usage_desc" ? Prisma.sql`(SELECT COUNT(*) FROM "inventory_movements" m WHERE m."inventoryItemId" = i.id AND m."quantityDelta" < 0 AND m.type::text IN ('WORK_ORDER_USE', 'MANUAL_EXIT', 'ADJUSTMENT_OUT')) DESC`
      : Prisma.sql`COALESCE(i."customName", cp.name) ASC`;
    const base = Prisma.sql`FROM "inventory_items" i LEFT JOIN "catalog_parts" cp ON cp.id=i."catalogPartId" LEFT JOIN "brands" b ON b.id=i."brandId" LEFT JOIN "part_categories" c ON c.id=i."categoryId" WHERE i."workshopId"=${context.workshopId} AND i.active=true ${search} ${category} ${brand} ${location} ${status}`;
    const ids = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT i.id ${base} ORDER BY ${order}, i.id ASC LIMIT ${query.size} OFFSET ${(query.page - 1) * query.size}`);
    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total ${base}`);
    const rows = ids.length ? await prisma.inventoryItem.findMany({ where: { id: { in: ids.map((item) => item.id) }, workshopId: context.workshopId }, include: itemInclude }) : [];
    const usageRows = ids.length ? await prisma.$queryRaw<Array<{ id: string; usageCount: bigint; unitsUsed: Prisma.Decimal }>>(Prisma.sql`SELECT m."inventoryItemId" id, COUNT(*)::bigint "usageCount", COALESCE(SUM(-m."quantityDelta"), 0) "unitsUsed" FROM "inventory_movements" m WHERE m."workshopId"=${context.workshopId} AND m."inventoryItemId" IN (${Prisma.join(ids.map((item) => item.id))}) AND m."quantityDelta" < 0 AND m.type::text IN ('WORK_ORDER_USE', 'MANUAL_EXIT', 'ADJUSTMENT_OUT') GROUP BY m."inventoryItemId"`) : [];
    const usageById = new Map(usageRows.map((item) => [item.id, item]));
    const byId = new Map(rows.map((item) => [item.id, item]));
    const items = ids.flatMap(({ id }) => { const item = byId.get(id); const usage = usageById.get(id); return item ? [{ ...item, physicalQuantity: item.quantity, availableQuantity: item.quantity.minus(item.reservedQuantity), usageCount: Number(usage?.usageCount || 0), unitsUsed: Number(usage?.unitsUsed || 0) }] : []; });
    const summaryRows = await prisma.$queryRaw<Array<{ registered: bigint; available: Prisma.Decimal; low: bigint; zero: bigint; totalCostCents: Prisma.Decimal; movementsToday: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint registered, COALESCE(SUM(i.quantity-i."reservedQuantity"),0) available, COUNT(*) FILTER (WHERE (i.quantity-i."reservedQuantity")>0 AND (i.quantity-i."reservedQuantity")<=i."minimumQuantity")::bigint low, COUNT(*) FILTER (WHERE (i.quantity-i."reservedQuantity")=0)::bigint zero, COALESCE(SUM(i.quantity*COALESCE(i."costPriceCents",0)),0) "totalCostCents", (SELECT COUNT(*)::bigint FROM "inventory_movements" m WHERE m."workshopId"=${context.workshopId} AND m.type::text NOT IN ('STOCK_RESERVATION', 'RESERVATION_RELEASE') AND (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) "movementsToday" FROM "inventory_items" i WHERE i."workshopId"=${context.workshopId} AND i.active=true`);
    const locationRows = await prisma.inventoryItem.findMany({ where: { workshopId: context.workshopId, active: true, location: { not: null } }, distinct: ["location"], select: { location: true }, orderBy: { location: "asc" } });
    const summary = summaryRows[0]!; const total = Number(count[0]?.total || 0);
    return { items, total, page: query.page, size: query.size, pageCount: Math.ceil(total / query.size), locations: locationRows.flatMap((item) => item.location ? [item.location] : []), summary: { registered: Number(summary.registered), available: Number(summary.available), low: Number(summary.low), zero: Number(summary.zero), reorder: Number(summary.low) + Number(summary.zero), totalCostCents: Math.round(Number(summary.totalCostCents)), movementsToday: Number(summary.movementsToday) } };
  },

  async get(context: RequestContext, id: string) {
    const item = await findOwned(context, id);
    const latestMovement = await prisma.inventoryMovement.findFirst({ where: { workshopId: context.workshopId, inventoryItemId: id }, orderBy: { createdAt: "desc" } });
    return { ...item, physicalQuantity: item.quantity, availableQuantity: item.quantity.minus(item.reservedQuantity), latestMovement };
  },

  async update(context: RequestContext, id: string, input: { name?: string; brandId?: string | null; categoryId?: string | null; sku?: string | null; minimumQuantity?: number; location?: string | null; supplierName?: string | null; salePriceCents?: number; notes?: string | null }) {
    requirePermission(context, "ADJUST_STOCK");
    try {
      return await runSerializableTransaction(async (transaction) => {
        const item = await findOwned(context, id, transaction);
        await assertActiveBrand(input.brandId ?? undefined, transaction);
        if (input.categoryId && !await transaction.partCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } })) throw new DomainError("Categoria não encontrada.", 400, "INVALID_CATEGORY");
        return transaction.inventoryItem.update({ where: { id: item.id }, data: { ...(input.name !== undefined && !item.catalogPartId ? { customName: input.name } : {}), brandId: input.brandId, categoryId: input.categoryId, sku: input.sku, minimumQuantity: input.minimumQuantity, location: input.location, supplierName: input.supplierName, salePriceCents: input.salePriceCents, notes: input.notes, version: { increment: 1 } }, include: itemInclude });
      });
    } catch (error) { if ((error as { code?: string }).code === "P2002") throw new DomainError("SKU já utilizado nesta oficina.", 409, "DUPLICATE_SKU"); throw error; }
  },

  async deactivate(context: RequestContext, id: string) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => { const item = await findOwned(context, id, transaction); if (item.reservedQuantity.isPositive()) throw new DomainError("Libere as reservas antes de desativar esta peça.", 409, "ACTIVE_RESERVATIONS"); return transaction.inventoryItem.update({ where: { id: item.id }, data: { active: false, version: { increment: 1 } }, include: itemInclude }); });
  },

  createCustom(context: RequestContext, input: CreateCustomInventoryItemInput) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      await assertActiveBrand(input.brandId, transaction);
      const item = await transaction.inventoryItem.create({ data: { workshopId: context.workshopId, customName: input.customName, brandId: input.brandId, categoryId: input.categoryId, quantity: new Prisma.Decimal(input.quantity), minimumQuantity: new Prisma.Decimal(input.minimumQuantity), unitOfMeasure: input.unitOfMeasure, costPriceCents: input.costPriceCents, salePriceCents: input.salePriceCents, location: input.location, sku: input.sku, supplierName: input.supplierName, notes: input.notes }, include: itemInclude });
      if (input.quantity > 0) await transaction.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: item.id, type: "STOCK_ENTRY", quantityDelta: new Prisma.Decimal(input.quantity), unitCostCents: input.costPriceCents, supplierName: input.supplierName, purchaseDocument: input.purchaseDocument, purchaseDate: input.purchaseDate ? new Date(`${input.purchaseDate}T00:00:00.000Z`) : undefined, reason: input.reason || "Saldo inicial", originDestination: "Compra / saldo inicial", physicalBefore: 0, physicalAfter: input.quantity, reservedBefore: 0, reservedAfter: 0, createdById: context.userId } });
      return item;
    });
  },

  async createFromCatalog(context: RequestContext, input: CreateCatalogInventoryItemInput) {
    requirePermission(context, "ADJUST_STOCK");
    try {
      return await runSerializableTransaction(async (transaction) => {
        const catalogPart = await transaction.catalogPart.findFirst({ where: { id: input.catalogPartId, active: true }, select: { id: true, categoryId: true } });
        if (!catalogPart) throw new DomainError("Peça não encontrada no catálogo.", 404, "CATALOG_PART_NOT_FOUND");
        await assertActiveBrand(input.brandId, transaction);
        const existing = await transaction.inventoryItem.findFirst({ where: { workshopId: context.workshopId, catalogPartId: input.catalogPartId, brandId: input.brandId ?? null }, select: { id: true } });
        if (existing) throw new DomainError("Esta peça já pertence ao estoque da oficina.", 409, "INVENTORY_ITEM_ALREADY_EXISTS");
        const item = await transaction.inventoryItem.create({
          data: {
            workshopId: context.workshopId,
            catalogPartId: input.catalogPartId,
            brandId: input.brandId,
            categoryId: input.categoryId ?? catalogPart.categoryId,
            quantity: 0,
            minimumQuantity: new Prisma.Decimal(input.minimumQuantity),
            costPriceCents: input.costPriceCents,
            salePriceCents: input.salePriceCents,
            location: input.location,
            sku: input.sku,
            supplierName: input.supplierName,
            notes: input.notes,
          },
        });
        await applyEntry(context, item.id, { quantity: input.quantity, unitCostCents: input.costPriceCents, purchaseDocument: input.purchaseDocument, purchaseDate: input.purchaseDate, supplierName: input.supplierName, reason: input.reason ?? "Saldo inicial pelo catálogo" }, transaction);
        return transaction.inventoryItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new DomainError("Esta peça já pertence ao estoque da oficina.", 409, "INVENTORY_ITEM_ALREADY_EXISTS");
      throw error;
    }
  },

  entry(context: RequestContext, id: string, details: StockEntryDetails) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction((transaction) => applyEntry(context, id, details, transaction));
  },

  physicalCount(context: RequestContext, id: string, countedQuantity: number, reason: string) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      const item = await findOwned(context, id, transaction); const counted = new Prisma.Decimal(countedQuantity); const delta = counted.minus(item.quantity);
      if (counted.lessThan(item.reservedQuantity)) throw new DomainError("Contagem física não pode ficar abaixo da quantidade reservada.", 409, "RESERVED_STOCK_CONFLICT");
      if (delta.isZero()) return item;
      const updated = await transaction.inventoryItem.update({ where: { id: item.id }, data: { quantity: counted }, include: itemInclude });
      await transaction.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: item.id, type: delta.isPositive() ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", quantityDelta: delta, reason, originDestination: "Contagem física", physicalBefore: item.quantity, physicalAfter: updated.quantity, reservedBefore: item.reservedQuantity, reservedAfter: updated.reservedQuantity, createdById: context.userId } });
      return updated;
    });
  },

  manualExit(context: RequestContext, id: string, input: ManualExitInput) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      const item = await findOwned(context, id, transaction); const delta = new Prisma.Decimal(input.quantity);
      if (item.quantity.minus(item.reservedQuantity).lessThan(delta)) throw new DomainError("Saldo disponível insuficiente para esta saída.", 409, "INSUFFICIENT_AVAILABLE_STOCK");
      const updated = await transaction.inventoryItem.update({ where: { id: item.id }, data: { quantity: { decrement: delta } }, include: itemInclude });
      await transaction.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: item.id, type: "MANUAL_EXIT", quantityDelta: delta.negated(), manualExitReason: input.reasonCode, purchaseDocument: input.document, reason: input.notes, originDestination: "Saída manual", physicalBefore: item.quantity, physicalAfter: updated.quantity, reservedBefore: item.reservedQuantity, reservedAfter: updated.reservedQuantity, createdById: context.userId } });
      return updated;
    });
  },

  batchEntry(context: RequestContext, input: { items: Array<{ inventoryItemId: string; quantity: number; unitCostCents?: number }>; supplierName?: string; purchaseDocument?: string; purchaseDate?: string; reason?: string }) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      const ids = [...new Set(input.items.map((item) => item.inventoryItemId))];
      if (ids.length !== input.items.length) throw new DomainError("Cada peça deve aparecer uma vez no lote.", 400, "DUPLICATE_BATCH_ITEM");
      const owned = await transaction.inventoryItem.findMany({ where: { id: { in: ids }, workshopId: context.workshopId, active: true }, select: { id: true } });
      if (owned.length !== ids.length) throw new DomainError("Uma ou mais peças não pertencem à oficina.", 400, "INVALID_BATCH_ITEM");
      for (const line of input.items) {
        await applyEntry(context, line.inventoryItemId, { ...line, supplierName: input.supplierName, purchaseDocument: input.purchaseDocument, purchaseDate: input.purchaseDate, reason: input.reason }, transaction);
      }
      return { processed: input.items.length };
    });
  },

  batchPhysicalCount(context: RequestContext, input: { items: Array<{ inventoryItemId: string; countedQuantity: number }>; reason: string }) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      const ids = [...new Set(input.items.map((item) => item.inventoryItemId))];
      if (ids.length !== input.items.length) throw new DomainError("Cada peça deve aparecer uma vez na contagem.", 400, "DUPLICATE_COUNT_ITEM");
      const current = await transaction.inventoryItem.findMany({ where: { id: { in: ids }, workshopId: context.workshopId, active: true } });
      if (current.length !== ids.length) throw new DomainError("Uma ou mais peças não pertencem à oficina.", 400, "INVALID_COUNT_ITEM");
      const byId = new Map(current.map((item) => [item.id, item]));
      let adjusted = 0;
      for (const line of input.items) {
        const item = byId.get(line.inventoryItemId)!;
        const counted = new Prisma.Decimal(line.countedQuantity);
        if (counted.lessThan(item.reservedQuantity)) throw new DomainError(`A contagem de ${item.customName || item.id} não pode ficar abaixo do reservado.`, 409, "RESERVED_STOCK_CONFLICT");
        const delta = counted.minus(item.quantity);
        if (delta.isZero()) continue;
        const updated = await transaction.inventoryItem.update({ where: { id: item.id }, data: { quantity: counted } });
        await transaction.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: item.id, type: delta.isPositive() ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", quantityDelta: delta, reason: input.reason, originDestination: "Inventário físico", physicalBefore: item.quantity, physicalAfter: updated.quantity, reservedBefore: item.reservedQuantity, reservedAfter: updated.reservedQuantity, createdById: context.userId } });
        adjusted += 1;
      }
      return { counted: input.items.length, adjusted };
    });
  },

  reverseMovement(context: RequestContext, movementId: string, reason: string) {
    requirePermission(context, "ADJUST_STOCK");
    return runSerializableTransaction(async (transaction) => {
      const movement = await transaction.inventoryMovement.findFirst({ where: { id: movementId, workshopId: context.workshopId }, include: { inventoryItem: true, reversals: { select: { id: true } } } });
      if (!movement) throw new DomainError("Movimentação não encontrada.", 404, "MOVEMENT_NOT_FOUND");
      if (movement.originalMovementId || movement.reversals.length) throw new DomainError("Esta movimentação já foi estornada ou é um estorno.", 409, "MOVEMENT_ALREADY_REVERSED");
      if (movement.workOrderId) throw new DomainError("Movimentações de OS são revertidas pelo fluxo da própria OS.", 409, "WORK_ORDER_MOVEMENT");
      const inverse = movement.quantityDelta.negated();
      const resulting = movement.inventoryItem.quantity.plus(inverse);
      if (resulting.lessThan(movement.inventoryItem.reservedQuantity)) throw new DomainError("O estorno deixaria o estoque físico abaixo do reservado.", 409, "RESERVED_STOCK_CONFLICT");
      const updated = await transaction.inventoryItem.update({ where: { id: movement.inventoryItemId }, data: { quantity: resulting } });
      return transaction.inventoryMovement.create({ data: { workshopId: context.workshopId, inventoryItemId: movement.inventoryItemId, type: "MANUAL_ADJUSTMENT", quantityDelta: inverse, reason, originalMovementId: movement.id, originDestination: "Estorno", physicalBefore: movement.inventoryItem.quantity, physicalAfter: updated.quantity, reservedBefore: movement.inventoryItem.reservedQuantity, reservedAfter: updated.reservedQuantity, createdById: context.userId } });
    });
  },

  movements(context: RequestContext, inventoryItemId?: string) {
    return prisma.inventoryMovement.findMany({ where: { workshopId: context.workshopId, ...(inventoryItemId ? { inventoryItemId } : {}) }, include: { inventoryItem: { include: itemInclude }, workOrder: { select: { id: true, number: true } } }, orderBy: { createdAt: "desc" }, take: 500 }).then(async (movements) => {
      const users = await prisma.user.findMany({ where: { id: { in: [...new Set(movements.map((movement) => movement.createdById))] } }, select: { id: true, name: true } }); const names = new Map(users.map((user) => [user.id, user.name]));
      return movements.map((movement) => ({ ...movement, createdBy: names.has(movement.createdById) ? { id: movement.createdById, name: names.get(movement.createdById)! } : null }));
    });
  },
};
