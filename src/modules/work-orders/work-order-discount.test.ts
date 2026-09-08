import { describe, expect, it } from "vitest";
import { calculateGeneralDiscount } from "./services/work-order-discount-service";

describe("calculateGeneralDiscount", () => {
  it("calcula desconto fixo em centavos sem float", () => expect(calculateGeneralDiscount(29_480, "FIXED", "19,90").cents).toBe(1_990));
  it("calcula desconto percentual", () => expect(calculateGeneralDiscount(29_480, "PERCENT", "10").cents).toBe(2_948));
  it("rejeita percentual acima de 100", () => expect(() => calculateGeneralDiscount(100, "PERCENT", "100.01")).toThrow(/100%/));
  it("rejeita desconto acima do subtotal", () => expect(() => calculateGeneralDiscount(100, "FIXED", "1.01")).toThrow(/subtotal/));
});
