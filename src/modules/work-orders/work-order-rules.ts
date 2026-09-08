export type WorkOrderMacroStatus = "OPEN" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED";
export type WorkOrderCommand = "start" | "pause" | "resume" | "ready" | "deliver" | "cancel" | "reopen_ready" | "reopen_completed";

export type WorkOrderRuleSnapshot = {
  status: WorkOrderMacroStatus;
  approvalStatus: "PENDING" | "PARTIALLY_APPROVED" | "APPROVED" | "REJECTED";
  assignedMechanicId: string | null;
  diagnosis: string;
  executionPausedAt?: Date | null;
  services: Array<{ status: string; nameSnapshot: string }>;
  checklists: Array<{ title: string; required: boolean; items: Array<{ required: boolean; result: string }> }>;
  paymentRequired?: boolean;
  paymentStatus?: "PENDING" | "PAID" | "WAIVED";
};

export type WorkOrderPending = {
  code: string;
  message: string;
  blocking: boolean;
};

const allowedCommands: Record<WorkOrderMacroStatus, ReadonlySet<WorkOrderCommand>> = {
  OPEN: new Set(["start", "cancel"]),
  IN_PROGRESS: new Set(["pause", "resume", "ready", "cancel"]),
  READY: new Set(["deliver", "cancel", "reopen_ready"]),
  COMPLETED: new Set(["reopen_completed"]),
  CANCELLED: new Set(),
};

export function canRunWorkOrderCommand(status: WorkOrderMacroStatus, command: WorkOrderCommand) {
  return allowedCommands[status].has(command);
}

export function calculateWorkOrderPendings(order: WorkOrderRuleSnapshot): WorkOrderPending[] {
  const pendings: WorkOrderPending[] = [];
  if (!order.diagnosis.trim()) pendings.push({ code: "DIAGNOSIS_EMPTY", message: "Diagnóstico técnico não preenchido.", blocking: false });
  if (order.approvalStatus === "PENDING") pendings.push({ code: "QUOTE_PENDING", message: "Orçamento aguardando aprovação.", blocking: true });
  if (order.approvalStatus === "PARTIALLY_APPROVED") pendings.push({ code: "QUOTE_PARTIAL", message: "Orçamento aprovado parcialmente; itens recusados não serão executados.", blocking: false });
  if (order.approvalStatus === "REJECTED") pendings.push({ code: "QUOTE_REJECTED", message: "Orçamento recusado; gere uma nova versão.", blocking: true });
  if (!order.assignedMechanicId) pendings.push({ code: "MECHANIC_REQUIRED", message: "Mecânico responsável não atribuído.", blocking: true });

  for (const service of order.services) {
    if (["APPROVED", "IN_PROGRESS", "PENDING"].includes(service.status)) {
      pendings.push({ code: "SERVICE_PENDING", message: `Serviço “${service.nameSnapshot}” ainda não foi concluído.`, blocking: true });
    }
  }

  for (const checklist of order.checklists.filter((item) => item.required)) {
    const incomplete = checklist.items.filter((item) => item.required && item.result === "PENDING").length;
    const rejected = checklist.items.filter((item) => item.required && item.result === "REJECTED").length;
    if (incomplete) pendings.push({ code: "CHECKLIST_INCOMPLETE", message: `${checklist.title}: ${incomplete} item(ns) obrigatório(s) pendente(s).`, blocking: true });
    if (rejected) pendings.push({ code: "CHECKLIST_REJECTED", message: `${checklist.title}: ${rejected} item(ns) reprovado(s).`, blocking: true });
  }

  if (order.paymentRequired && order.paymentStatus === "PENDING") {
    pendings.push({ code: "PAYMENT_PENDING", message: "Pagamento ainda não confirmado.", blocking: order.status === "READY" });
  }
  return pendings;
}

export function blockingPendingsFor(command: WorkOrderCommand, order: WorkOrderRuleSnapshot) {
  const pendings = calculateWorkOrderPendings(order);
  if (command === "start") return pendings.filter((item) => ["QUOTE_PENDING", "QUOTE_REJECTED", "MECHANIC_REQUIRED"].includes(item.code));
  if (command === "ready") return pendings.filter((item) => item.blocking && item.code !== "PAYMENT_PENDING");
  if (command === "deliver") return pendings.filter((item) => item.code === "PAYMENT_PENDING");
  return [];
}
