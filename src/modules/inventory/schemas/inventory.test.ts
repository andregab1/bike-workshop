import { describe, expect, it } from "vitest";
import { createCatalogInventoryItemSchema, inventoryListQuerySchema } from "./inventory";

describe("createCatalogInventoryItemSchema", () => {
  const valid = { catalogPartId: "part-1", quantity: 2, minimumQuantity: 0, costPriceCents: 1990, salePriceCents: 3990, purchaseDocument: "NF-1", purchaseDate: "2026-08-25" };
  it("aceita entrada completa em centavos", () => { expect(createCatalogInventoryItemSchema.parse(valid)).toMatchObject(valid); });
  it("aceita qualquer marca ou nenhuma marca para a mesma peça", () => { expect(createCatalogInventoryItemSchema.parse({ ...valid, brandId: "brand-shimano" }).brandId).toBe("brand-shimano"); expect(createCatalogInventoryItemSchema.parse(valid).brandId).toBeUndefined(); });
  it("rejeita quantidade zero ou precisão excessiva", () => { expect(() => createCatalogInventoryItemSchema.parse({ ...valid, quantity: 0 })).toThrow(); expect(() => createCatalogInventoryItemSchema.parse({ ...valid, quantity: 1.0001 })).toThrow(); });
  it("exige documento e data", () => { expect(() => createCatalogInventoryItemSchema.parse({ ...valid, purchaseDocument: "" })).toThrow(); expect(() => createCatalogInventoryItemSchema.parse({ ...valid, purchaseDate: undefined })).toThrow(); });
});

describe("inventoryListQuerySchema", () => {
  it("accepts the visual inventory filters and usage order", () => {
    expect(inventoryListQuerySchema.parse({ location: "B-03", status: "reorder", sort: "usage_desc" })).toMatchObject({ location: "B-03", status: "reorder", sort: "usage_desc" });
  });
});
