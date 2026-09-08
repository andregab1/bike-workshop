import { describe, expect, it } from "vitest";

import { normalizeCpfCnpj, normalizeEmail, normalizePhone } from "./customer-identity";
import { createCustomerSchema } from "./schemas/customer";

describe("customer identity normalization", () => {
  it("normalizes fields used for duplicate detection", () => {
    expect(normalizePhone("(41) 99999-0000")).toBe("41999990000");
    expect(normalizeEmail("  Cliente@Exemplo.COM ")).toBe("cliente@exemplo.com");
    expect(normalizeCpfCnpj("123.456.789-01")).toBe("12345678901");
  });

  it("accepts formatted customer data and normalizes the state", () => {
    const customer = createCustomerSchema.parse({
      name: "Carlos Silva",
      phone: "(41) 99999-0000",
      cpfCnpj: "123.456.789-01",
      state: "pr",
    });

    expect(customer.state).toBe("PR");
  });

  it("rejects invalid identity lengths", () => {
    expect(() => createCustomerSchema.parse({ name: "Carlos Silva", phone: "123" })).toThrow();
    expect(() => createCustomerSchema.parse({ name: "Carlos Silva", phone: "41999990000", cpfCnpj: "123" })).toThrow();
  });
});
