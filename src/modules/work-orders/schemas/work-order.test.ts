import { describe, expect, it } from "vitest";
import { completeWorkOrderSchema, createWorkOrderSchema, workOrderListQuerySchema } from "./work-order";

describe("work order contracts", () => {
  it("always requires a bike and customer complaint", () => {
    expect(createWorkOrderSchema.safeParse({ bikeId: "bike-1", complaint: "Freio traseiro fraco" }).success).toBe(true);
    expect(createWorkOrderSchema.safeParse({ bikeId: "", complaint: "x" }).success).toBe(false);
  });
  it("limits server-side pagination", () => {
    expect(workOrderListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(workOrderListQuerySchema.parse({ page: "2" }).page).toBe(2);
  });
  it("oculta recusadas por padrão e aceita inclusão explícita", () => {
    expect(workOrderListQuerySchema.parse({}).includeRejected).toBe("false");
    expect(workOrderListQuerySchema.parse({ includeRejected: "true" }).includeRejected).toBe("true");
  });
  it("requires explicit pickup acceptance", () => {
    expect(completeWorkOrderSchema.safeParse({ pickedUpByName: "Carlos Silva", accepted: true }).success).toBe(true);
    expect(completeWorkOrderSchema.safeParse({ pickedUpByName: "Carlos Silva", accepted: false }).success).toBe(false);
  });
});
