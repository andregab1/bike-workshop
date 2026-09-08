import { describe, expect, it } from "vitest";
import { workOrderSensitiveChanges } from "./work-order-pricing-policy";

const service = (price: number) => ({ serviceCatalogItemId: "service-1", name: "Regulagem", unitPriceCents: price, discountCents: 0, surchargeCents: 0 });
describe("workOrderSensitiveChanges", () => {
  it("não exige motivo ao adicionar serviço pelo preço oficial", () => { expect(workOrderSensitiveChanges([service(5000)], [], [], [], new Map([["service-1", 5000]]), new Map())).toEqual({ pricingChanged: false, adjustmentsChanged: false }); });
  it("detecta preço diferente do catálogo em linha nova", () => { expect(workOrderSensitiveChanges([service(4000)], [], [], [], new Map([["service-1", 5000]]), new Map()).pricingChanged).toBe(true); });
  it("detecta alteração no preço de linha existente", () => { expect(workOrderSensitiveChanges([service(4500)], [service(5000)], [], [], new Map(), new Map()).pricingChanged).toBe(true); });
});
