import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { manualExitSchema } from "@/modules/inventory/schemas/inventory";
import { weightedAverageCost } from "./inventory-policy";

describe("inventory policy", () => {
  it("calculates weighted average cost without changing historical movements", () => {
    expect(weightedAverageCost(new Prisma.Decimal(10), 1_000, new Prisma.Decimal(5), 1_600)).toBe(1_200);
  });

  it("keeps known cost when entry has no cost and initializes unknown cost", () => {
    expect(weightedAverageCost(new Prisma.Decimal(4), 900, new Prisma.Decimal(2))).toBe(900);
    expect(weightedAverageCost(new Prisma.Decimal(4), null, new Prisma.Decimal(2), 700)).toBe(700);
  });

  it("accepts structured exit reason and keeps legacy clients compatible", () => {
    expect(manualExitSchema.parse({ quantity: 1, reasonCode: "DANO", notes: "Quebrada" })).toMatchObject({ reasonCode: "DANO", notes: "Quebrada" });
    expect(manualExitSchema.parse({ quantity: 1, reason: "Uso antigo" })).toMatchObject({ reasonCode: "OUTRO", notes: "Uso antigo" });
    expect(() => manualExitSchema.parse({ quantity: 1 })).toThrow();
  });
});
