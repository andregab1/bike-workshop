import { describe, expect, it } from "vitest";
import { createCustomerSchema } from "./customer";

describe("createCustomerSchema", () => {
  it("aceita cliente sem endereço e remove preferências de comunicação antigas", () => {
    const parsed = createCustomerSchema.parse({ name: "Ana Souza", phone: "(11) 99999-0000", preferredContactChannel: "WHATSAPP", communicationConsent: true });
    expect(parsed).toMatchObject({ name: "Ana Souza", phone: "(11) 99999-0000" });
    expect(parsed).not.toHaveProperty("preferredContactChannel");
    expect(parsed).not.toHaveProperty("communicationConsent");
    expect(parsed).not.toHaveProperty("street");
  });
});
