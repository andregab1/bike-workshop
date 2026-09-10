import "server-only";

import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { normalizeCpfCnpj, normalizeEmail, normalizePhone } from "@/modules/customers/customer-identity";
import { DomainError } from "@/shared/http/errors";
import type { CreateCustomerInput, DuplicateCustomerInput, UpdateCustomerInput } from "@/modules/customers/schemas/customer";
import { requirePermission } from "@/shared/auth/permissions";
import type { Prisma } from "@/generated/prisma/client";

type ActiveFilter = boolean | "all";

export function customerSearchFilters(query: string): Prisma.CustomerWhereInput[] {
  const phone = normalizePhone(query);
  const email = normalizeEmail(query);
  const cpfCnpj = normalizeCpfCnpj(query);

  return [
    { name: { contains: query, mode: "insensitive" } },
    ...(phone ? [{ normalizedPhone: { contains: phone } } satisfies Prisma.CustomerWhereInput] : []),
    ...(email ? [{ normalizedEmail: { contains: email } } satisfies Prisma.CustomerWhereInput] : []),
    ...(cpfCnpj ? [{ normalizedCpfCnpj: { equals: cpfCnpj } } satisfies Prisma.CustomerWhereInput] : []),
  ];
}

function identityData(input: { phone: string; email?: string | null; cpfCnpj?: string | null }) {
  return {
    normalizedPhone: normalizePhone(input.phone),
    normalizedEmail: normalizeEmail(input.email),
    normalizedCpfCnpj: normalizeCpfCnpj(input.cpfCnpj),
  };
}

export const customerService = {
  list(context: RequestContext, query?: string, active: ActiveFilter = true) {
    return prisma.customer.findMany({
      where: {
        workshopId: context.workshopId,
        ...(active === "all" ? {} : { active }),
        ...(query ? { OR: customerSearchFilters(query) } : {}),
      },
      include: { bikes: { orderBy: { createdAt: "desc" } } },
      orderBy: { name: "asc" },
    });
  },

  async get(context: RequestContext, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, workshopId: context.workshopId },
      include: { bikes: { orderBy: { createdAt: "desc" } } },
    });
    if (!customer) throw new DomainError("Cliente não encontrado.", 404, "CUSTOMER_NOT_FOUND");
    return customer;
  },

  create(context: RequestContext, input: CreateCustomerInput) {
    requirePermission(context, "MANAGE_CUSTOMERS");
    return prisma.customer.create({ data: { ...input, ...identityData(input), workshopId: context.workshopId, createdById: context.userId }, include: { bikes: true } });
  },

  findDuplicates(context: RequestContext, input: DuplicateCustomerInput) {
    const matches: Prisma.CustomerWhereInput[] = [];
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const email = normalizeEmail(input.email);
    const cpfCnpj = normalizeCpfCnpj(input.cpfCnpj);
    if (phone) matches.push({ normalizedPhone: phone });
    if (email) matches.push({ normalizedEmail: email });
    if (cpfCnpj) matches.push({ normalizedCpfCnpj: cpfCnpj });

    return prisma.customer.findMany({
      where: {
        workshopId: context.workshopId,
        ...(input.excludeCustomerId ? { id: { not: input.excludeCustomerId } } : {}),
        OR: matches,
      },
      select: { id: true, name: true, phone: true, email: true, cpfCnpj: true, active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 10,
    });
  },

  async update(context: RequestContext, id: string, input: UpdateCustomerInput) {
    requirePermission(context, "MANAGE_CUSTOMERS");
    const current = await this.get(context, id);
    const data: Prisma.CustomerUpdateInput = { ...input };
    if (input.phone !== undefined) data.normalizedPhone = normalizePhone(input.phone);
    if (input.email !== undefined) data.normalizedEmail = normalizeEmail(input.email);
    if (input.cpfCnpj !== undefined) data.normalizedCpfCnpj = normalizeCpfCnpj(input.cpfCnpj);
    if (!current.active) throw new DomainError("Reative o cliente antes de editar.", 409, "CUSTOMER_ARCHIVED");
    return prisma.customer.update({ where: { id }, data, include: { bikes: { orderBy: { createdAt: "desc" } } } });
  },

  async archive(context: RequestContext, id: string) {
    requirePermission(context, "MANAGE_CUSTOMERS");
    const customer = await this.get(context, id);
    if (!customer.active) return customer;
    const activeOrder = await prisma.workOrder.findFirst({
      where: { workshopId: context.workshopId, status: { in: ["OPEN", "IN_PROGRESS", "READY"] }, OR: [{ customerSnapshotId: id }, { bike: { customerId: id } }] },
      select: { number: true },
    });
    if (activeOrder) throw new DomainError(`Conclua ou cancele a OS #${activeOrder.number} antes de arquivar o cliente.`, 409, "ACTIVE_WORK_ORDER");
    return prisma.customer.update({ where: { id }, data: { active: false } });
  },

  async reactivate(context: RequestContext, id: string) {
    requirePermission(context, "MANAGE_CUSTOMERS");
    const customer = await this.get(context, id);
    if (customer.active) return customer;
    return prisma.customer.update({ where: { id }, data: { active: true }, include: { bikes: { orderBy: { createdAt: "desc" } } } });
  },
};
