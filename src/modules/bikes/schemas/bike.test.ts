import { describe, expect, it } from "vitest";

import { createBikeSchema, updateBikeSchema } from "./bike";

describe("bike schemas", () => {
  it("accepts complete bike registration", () => {
    const bike = createBikeSchema.parse({
      brand: "Sense",
      model: "Impact Pro",
      year: 2025,
      type: "MTB",
      wheelSize: "29",
      frameSize: "M",
      serialNumber: "QA-BIKE-001",
    });

    expect(bike).toMatchObject({ brand: "Sense", model: "Impact Pro", year: 2025, type: "MTB" });
  });

  it("allows optional bike fields to be cleared", () => {
    expect(updateBikeSchema.parse({ color: "", year: null, type: null })).toEqual({ color: null, year: null, type: null });
  });

  it("rejects invalid years and missing identification", () => {
    expect(() => createBikeSchema.parse({ brand: "", model: "Impact Pro" })).toThrow();
    expect(() => createBikeSchema.parse({ brand: "Sense", model: "Impact Pro", year: 1800 })).toThrow();
  });
});
