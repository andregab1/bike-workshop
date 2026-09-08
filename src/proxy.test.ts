import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

describe("API origin protection", () => {
  it("allows same-origin mutations", () => {
    const request = new NextRequest("https://bikeflow.local/api/customers", {
      method: "POST",
      headers: { host: "bikeflow.local", origin: "https://bikeflow.local" },
    });

    expect(proxy(request).status).toBe(200);
  });

  it("blocks cross-origin mutations", async () => {
    const request = new NextRequest("https://bikeflow.local/api/customers", {
      method: "POST",
      headers: { host: "bikeflow.local", origin: "https://attacker.invalid" },
    });
    const response = proxy(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_REQUEST_ORIGIN" });
  });

  it("does not interfere with Better Auth routes", () => {
    const request = new NextRequest("https://bikeflow.local/api/auth/sign-in/email", {
      method: "POST",
      headers: { host: "bikeflow.local", origin: "https://attacker.invalid" },
    });

    expect(proxy(request).status).toBe(200);
  });
});
