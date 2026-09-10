import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./env";

const valid = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/app",
  BETTER_AUTH_SECRET: "a-secure-test-secret-with-32-characters",
  BETTER_AUTH_URL: "https://bike.example.com",
  DEMO_AUTH_ORGANIZATION_ID: "demo",
  DEMO_WORKSHOP_NAME: "Oficina",
  DEMO_WORKSHOP_SLUG: "oficina",
};

describe("server environment", () => {
  it("requires Better Auth configuration", () => {
    expect(() => parseServerEnvironment({ ...valid, BETTER_AUTH_SECRET: undefined }, "production")).toThrow(/BETTER_AUTH_SECRET is required/);
    expect(() => parseServerEnvironment({ ...valid, BETTER_AUTH_URL: undefined }, "production")).toThrow(/BETTER_AUTH_URL is required/);
  });

  it("requires HTTPS for Better Auth in production", () => {
    expect(() => parseServerEnvironment({ ...valid, BETTER_AUTH_URL: "http://bike.example.com" }, "production")).toThrow(/must use HTTPS/);
    expect(parseServerEnvironment({ ...valid, BETTER_AUTH_URL: "http://localhost:3000" }, "production").BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});
