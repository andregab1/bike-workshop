import { z } from "zod";

const decimalQuantity = z.coerce.number().finite().min(0).max(999_999_999).refine((value) => Number.isInteger(value * 1000), "Use no máximo três casas decimais.");
const positiveQuantity = decimalQuantity.refine((value) => value > 0, "A quantidade deve ser maior que zero.");

export const createCustomInventoryItemSchema = z.object({
  customName: z.string().trim().min(2).max(180),
  brandId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  quantity: decimalQuantity.default(0),
  minimumQuantity: decimalQuantity.default(0),
  unitOfMeasure: z.enum(["UNIT", "METER", "MILLILITER", "GRAM"]).default("UNIT"),
  costPriceCents: z.int().min(0).optional(),
  salePriceCents: z.int().min(0),
  location: z.string().trim().max(80).transform((value) => value || undefined).optional(),
  sku: z.string().trim().max(80).transform((value) => value || undefined).optional(),
  supplierName: z.string().trim().max(160).transform((value) => value || undefined).optional(),
  purchaseDocument: z.string().trim().min(1, "Informe o documento.").max(80),
  purchaseDate: z.iso.date(),
  reason: z.string().trim().max(240).transform((value) => value || undefined).optional(),
  notes: z.string().trim().max(1000).transform((value) => value || undefined).optional(),
});

export const stockEntrySchema = z.object({
  quantity: positiveQuantity,
  unitCostCents: z.int().min(0).optional(),
  salePriceCents: z.int().min(0).optional(),
  supplierName: z.string().trim().max(160).transform((value) => value || undefined).optional(),
  purchaseDocument: z.string().trim().max(80).transform((value) => value || undefined).optional(),
  purchaseDate: z.iso.date().optional(),
  reason: z.string().trim().max(240).transform((value) => value || undefined).optional(),
});

export const physicalCountSchema = z.object({
  countedQuantity: decimalQuantity,
  reason: z.string().trim().min(3).max(240).default("Inventário físico"),
});

export const inventoryListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  location: z.string().trim().max(80).optional(),
  status: z.enum(["all", "normal", "low", "zero", "reserved", "reorder"]).default("all"),
  sort: z.enum(["stock_asc", "stock_desc", "name_asc", "name_desc", "price_asc", "price_desc", "movement_desc", "usage_desc"]).default("name_asc"),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(30),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  brandId: z.string().trim().min(1).nullable().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  minimumQuantity: decimalQuantity.optional(),
  location: z.string().trim().max(80).nullable().optional(),
  supplierName: z.string().trim().max(160).nullable().optional(),
  salePriceCents: z.int().min(0).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const manualStockExitReasonSchema = z.enum(["USO_INTERNO", "PERDA", "DANO", "DEVOLUCAO", "OUTRO"]);

export const manualExitSchema = z.object({
  quantity: positiveQuantity,
  reasonCode: manualStockExitReasonSchema.optional(),
  reason: z.string().trim().min(3).max(240).optional(),
  document: z.string().trim().max(80).transform((value) => value || undefined).optional(),
  notes: z.string().trim().max(240).transform((value) => value || undefined).optional(),
}).superRefine((value, context) => {
  if (!value.reasonCode && !value.reason) context.addIssue({ code: "custom", message: "Informe o motivo da saída." });
}).transform((value) => ({ quantity: value.quantity, reasonCode: value.reasonCode ?? "OUTRO" as const, notes: value.notes ?? value.reason, document: value.document }));

export const createCatalogInventoryItemSchema = createCustomInventoryItemSchema.omit({ customName: true, unitOfMeasure: true }).extend({
  catalogPartId: z.string().min(1),
  quantity: positiveQuantity,
});

export const batchStockEntrySchema = z.object({
  items: z.array(z.object({ inventoryItemId: z.string().min(1), quantity: positiveQuantity, unitCostCents: z.int().min(0).optional() })).min(1).max(200),
  supplierName: z.string().trim().max(160).optional(),
  purchaseDocument: z.string().trim().max(80).optional(),
  purchaseDate: z.iso.date().optional(),
  reason: z.string().trim().max(240).optional(),
});

export const batchPhysicalCountSchema = z.object({
  items: z.array(z.object({ inventoryItemId: z.string().min(1), countedQuantity: decimalQuantity })).min(1).max(500),
  reason: z.string().trim().min(3).max(240).default("Inventário físico"),
});

export const reverseMovementSchema = z.object({ reason: z.string().trim().min(3).max(240) });

export type CreateCustomInventoryItemInput = z.infer<typeof createCustomInventoryItemSchema>;
export type CreateCatalogInventoryItemInput = z.infer<typeof createCatalogInventoryItemSchema>;
export type ManualExitInput = z.infer<typeof manualExitSchema>;
