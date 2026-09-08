import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/lib/request-context";
import { requirePermission } from "./permissions";

const context = (role: RequestContext["role"]): RequestContext => ({ userId: "u", memberId: "m", workshopId: "w", role });
describe("role permissions", () => {
  it("allows stockkeeper to adjust stock", () => expect(() => requirePermission(context("STOCKKEEPER"), "ADJUST_STOCK")).not.toThrow());
  it("blocks mechanic from price changes", () => expect(() => requirePermission(context("MECHANIC"), "EDIT_PRICE")).toThrowError(/permissão/i));
  it("allows owner to manage users", () => expect(() => requirePermission(context("OWNER"), "MANAGE_USERS")).not.toThrow());
  it("allows attendants to manage customers and bikes", () => {
    expect(() => requirePermission(context("ATTENDANT"), "MANAGE_CUSTOMERS")).not.toThrow();
    expect(() => requirePermission(context("ATTENDANT"), "MANAGE_BIKES")).not.toThrow();
  });
  it("allows mechanics to manage bikes but not customer identities", () => {
    expect(() => requirePermission(context("MECHANIC"), "MANAGE_BIKES")).not.toThrow();
    expect(() => requirePermission(context("MECHANIC"), "MANAGE_CUSTOMERS")).toThrowError(/permissão/i);
  });
});
