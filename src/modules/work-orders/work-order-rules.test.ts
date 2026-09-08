import { describe, expect, it } from "vitest";
import { blockingPendingsFor, calculateWorkOrderPendings, canRunWorkOrderCommand } from "./work-order-rules";

const base = {
  status: "IN_PROGRESS" as const,
  approvalStatus: "APPROVED" as const,
  assignedMechanicId: "member-1",
  diagnosis: "Pastilha desgastada.",
  services: [{ status: "COMPLETED", nameSnapshot: "Troca de pastilha" }],
  checklists: [{ title: "Checklist técnico", required: true, items: [{ required: true, result: "OK" }] }],
};

describe("work order rules", () => {
  it("centraliza comandos permitidos por estado", () => {
    expect(canRunWorkOrderCommand("OPEN", "start")).toBe(true);
    expect(canRunWorkOrderCommand("OPEN", "deliver")).toBe(false);
    expect(canRunWorkOrderCommand("COMPLETED", "reopen_completed")).toBe(true);
  });

  it("bloqueia pronta com serviço aprovado pendente", () => {
    const order = { ...base, services: [{ status: "APPROVED", nameSnapshot: "Troca de pastilha" }] };
    expect(blockingPendingsFor("ready", order)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SERVICE_PENDING" })]));
  });

  it("bloqueia pronta com checklist obrigatório incompleto", () => {
    const order = { ...base, checklists: [{ title: "Checklist técnico", required: true, items: [{ required: true, result: "PENDING" }] }] };
    expect(blockingPendingsFor("ready", order)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CHECKLIST_INCOMPLETE" })]));
  });

  it("pagamento bloqueia entrega somente quando exigido", () => {
    const order = { ...base, status: "READY" as const, paymentRequired: true, paymentStatus: "PENDING" as const };
    expect(blockingPendingsFor("deliver", order)).toHaveLength(1);
    expect(calculateWorkOrderPendings({ ...order, paymentStatus: "PAID" })).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "PAYMENT_PENDING" })]));
  });
});
