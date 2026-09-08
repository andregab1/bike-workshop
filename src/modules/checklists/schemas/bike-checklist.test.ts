import { describe, expect, it } from "vitest";
import { bikeChecklistInputSchema, normalizeChecklistLabel } from "./bike-checklist";

describe("checklist operacional", () => {
  it("normaliza caixa, acento e espaços para evitar sugestões duplicadas", () => { expect(normalizeChecklistLabel("  Verificar   CÂMBIO ")).toBe("verificar cambio"); });
  it("exige cliente, bicicleta e item", () => { expect(() => bikeChecklistInputSchema.parse({ customerId: "", bikeId: "", title: "Teste", items: [] })).toThrow(); });
});
