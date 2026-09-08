import type { RequestContext } from "@/lib/request-context";
import { DomainError } from "@/shared/http/errors";

export function requireOwner(context: RequestContext) {
  if (context.role !== "OWNER") {
    throw new DomainError("Apenas proprietários podem alterar este catálogo.", 403, "OWNER_REQUIRED");
  }
}

export type Permission =
  | "EDIT_PRICE"
  | "APPLY_DISCOUNT"
  | "CANCEL_WORK_ORDER"
  | "ADJUST_STOCK"
  | "COMPLETE_WORK_ORDER"
  | "REOPEN_COMPLETED_ORDER"
  | "VIEW_COST"
  | "MANAGE_USERS"
  | "MANAGE_SETTINGS"
  | "MANAGE_CUSTOMERS"
  | "MANAGE_BIKES"
  | "MANAGE_WORK_ORDERS"
  | "APPROVE_QUOTE";

const rolePermissions: Record<RequestContext["role"], ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>(["EDIT_PRICE", "APPLY_DISCOUNT", "CANCEL_WORK_ORDER", "ADJUST_STOCK", "COMPLETE_WORK_ORDER", "REOPEN_COMPLETED_ORDER", "VIEW_COST", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_CUSTOMERS", "MANAGE_BIKES", "MANAGE_WORK_ORDERS", "APPROVE_QUOTE"]),
  MANAGER: new Set<Permission>(["EDIT_PRICE", "APPLY_DISCOUNT", "CANCEL_WORK_ORDER", "ADJUST_STOCK", "COMPLETE_WORK_ORDER", "REOPEN_COMPLETED_ORDER", "VIEW_COST", "MANAGE_USERS", "MANAGE_SETTINGS", "MANAGE_CUSTOMERS", "MANAGE_BIKES", "MANAGE_WORK_ORDERS", "APPROVE_QUOTE"]),
  ATTENDANT: new Set<Permission>(["APPLY_DISCOUNT", "COMPLETE_WORK_ORDER", "MANAGE_CUSTOMERS", "MANAGE_BIKES", "MANAGE_WORK_ORDERS", "APPROVE_QUOTE"]),
  MECHANIC: new Set<Permission>(["MANAGE_BIKES", "MANAGE_WORK_ORDERS"]),
  STOCKKEEPER: new Set<Permission>(["ADJUST_STOCK", "VIEW_COST"]),
};

export function requirePermission(context: RequestContext, permission: Permission) {
  if (!rolePermissions[context.role].has(permission)) {
    throw new DomainError("Você não possui permissão para esta ação.", 403, "PERMISSION_DENIED");
  }
}
