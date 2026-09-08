import { describe, expect, it } from "vitest";
import { serviceCatalogInputSchema } from "./service-catalog";

describe("serviceCatalogInputSchema", () => {
  it("aceita serviço sem categoria, duração e garantia", () => {
    expect(serviceCatalogInputSchema.parse({ name: "Regulagem de câmbio", priceCents: 5000 })).toEqual({ name: "Regulagem de câmbio", priceCents: 5000 });
  });
  it("rejeita centavos inválidos", () => { expect(() => serviceCatalogInputSchema.parse({ name: "Serviço", priceCents: Number.NaN })).toThrow(); });
});
