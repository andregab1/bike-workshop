import type { WorkshopRole } from "@/generated/prisma/enums";
import type { RequestContext } from "@/lib/request-context";
import { DomainError } from "@/shared/http/errors";

export function assertCanManageMember(
  context: RequestContext,
  target: { id: string; role: WorkshopRole },
  change: { active?: boolean; role?: WorkshopRole },
) {
  if (target.id === context.memberId && (change.active === false || (change.role && change.role !== target.role))) {
    throw new DomainError("Você não pode remover ou rebaixar seu próprio acesso.", 409, "SELF_ACCESS_CHANGE");
  }
  if (context.role !== "OWNER" && (target.role === "OWNER" || change.role === "OWNER")) {
    throw new DomainError("Apenas proprietários podem gerenciar outro proprietário.", 403, "OWNER_REQUIRED");
  }
}

export function assertCanGrantRole(context: RequestContext, role: WorkshopRole) {
  if (role === "OWNER" && context.role !== "OWNER") {
    throw new DomainError("Apenas proprietários podem conceder este papel.", 403, "OWNER_REQUIRED");
  }
}
