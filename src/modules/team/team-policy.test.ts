import { describe, expect, it } from "vitest";

import type { RequestContext } from "@/lib/request-context";
import { assertCanGrantRole, assertCanManageMember } from "./team-policy";
import { updateMemberSchema } from "./schemas/team";

const context = (role: RequestContext["role"], memberId = "actor"): RequestContext => ({ userId: "user", workshopId: "workshop", memberId, role });

describe("team policy", () => {
  it("blocks self deactivation and self demotion", () => {
    expect(() => assertCanManageMember(context("OWNER"), { id: "actor", role: "OWNER" }, { active: false })).toThrow();
    expect(() => assertCanManageMember(context("OWNER"), { id: "actor", role: "OWNER" }, { role: "MANAGER" })).toThrow();
  });

  it("blocks managers from changing owners or granting owner", () => {
    expect(() => assertCanManageMember(context("MANAGER"), { id: "owner", role: "OWNER" }, { active: false })).toThrow();
    expect(() => assertCanGrantRole(context("MANAGER"), "OWNER")).toThrow();
  });

  it("allows owner to promote another member", () => {
    expect(() => assertCanManageMember(context("OWNER"), { id: "mechanic", role: "MECHANIC" }, { role: "OWNER" })).not.toThrow();
    expect(() => assertCanGrantRole(context("OWNER"), "OWNER")).not.toThrow();
  });

  it("accepts profile name and role edits", () => {
    expect(updateMemberSchema.parse({ name: "Mecânico João", role: "MECHANIC" })).toEqual({ name: "Mecânico João", role: "MECHANIC" });
  });
});
