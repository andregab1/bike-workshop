import "server-only";

import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/shared/http/errors";
import { requirePermission } from "@/shared/auth/permissions";
import type { CreateBikeInput, UpdateBikeInput } from "@/modules/bikes/schemas/bike";

export const bikeService = {
  async create(context: RequestContext, customerId: string, input: CreateBikeInput) {
    requirePermission(context, "MANAGE_BIKES");
    const customer = await prisma.customer.findFirst({ where: { id: customerId, workshopId: context.workshopId, active: true }, select: { id: true } });
    if (!customer) throw new DomainError("Cliente não encontrado.", 404, "CUSTOMER_NOT_FOUND");
    return prisma.bike.create({ data: { ...input, customerId: customer.id, workshopId: context.workshopId } });
  },

  async update(context: RequestContext, id: string, input: UpdateBikeInput) {
    requirePermission(context, "MANAGE_BIKES");
    const bike = await prisma.bike.findFirst({ where: { id, workshopId: context.workshopId, active: true, customer: { active: true } }, select: { id: true } });
    if (!bike) throw new DomainError("Bicicleta não encontrada.", 404, "BIKE_NOT_FOUND");
    return prisma.bike.update({ where: { id: bike.id }, data: input });
  },

  async archive(context: RequestContext, id: string) {
    requirePermission(context, "MANAGE_BIKES");
    const bike = await prisma.bike.findFirst({ where: { id, workshopId: context.workshopId, active: true }, select: { id: true } });
    if (!bike) throw new DomainError("Bicicleta não encontrada.", 404, "BIKE_NOT_FOUND");
    const activeOrder = await prisma.workOrder.findFirst({ where: { bikeId: id, workshopId: context.workshopId, status: { in: ["OPEN", "IN_PROGRESS", "READY"] } }, select: { number: true } });
    if (activeOrder) throw new DomainError(`Conclua ou cancele a OS #${activeOrder.number} antes de arquivar a bicicleta.`, 409, "ACTIVE_WORK_ORDER");
    return prisma.bike.update({ where: { id: bike.id }, data: { active: false } });
  },

  async get(context: RequestContext, id: string) {
    const bike = await prisma.bike.findFirst({ where: { id, workshopId: context.workshopId }, include: { customer: true } });
    if (!bike) throw new DomainError("Bicicleta não encontrada.", 404, "BIKE_NOT_FOUND");
    return bike;
  },

  async reactivate(context: RequestContext, id: string) {
    requirePermission(context, "MANAGE_BIKES");
    const bike = await this.get(context, id);
    if (!bike.customer.active) throw new DomainError("Reative o cliente antes da bicicleta.", 409, "CUSTOMER_ARCHIVED");
    if (bike.active) return bike;
    return prisma.bike.update({ where: { id }, data: { active: true } });
  },

  async history(context: RequestContext, id: string) {
    const bike = await prisma.bike.findFirst({ where: { id, workshopId: context.workshopId }, include: { customer: true, ownershipTransfers: { orderBy: { changedAt: "desc" } }, workOrders: { where: { status: { not: "CANCELLED" } }, select: { id: true, number: true, status: true, createdAt: true, completedAt: true, services: { select: { nameSnapshot: true } }, parts: { select: { nameSnapshot: true } } }, orderBy: { createdAt: "desc" }, take: 50 } } });
    if (!bike) throw new DomainError("Bicicleta não encontrada.", 404, "BIKE_NOT_FOUND");
    return bike;
  },

  transfer(context: RequestContext, id: string, newCustomerId: string, reason: string) {
    requirePermission(context, "MANAGE_BIKES");
    return prisma.$transaction(async (transaction) => {
      const bike = await transaction.bike.findFirst({ where: { id, workshopId: context.workshopId, active: true } });
      if (!bike) throw new DomainError("Bicicleta não encontrada.", 404, "BIKE_NOT_FOUND");
      if (bike.customerId === newCustomerId) throw new DomainError("A bicicleta já pertence a este cliente.", 409, "SAME_OWNER");
      const customer = await transaction.customer.findFirst({ where: { id: newCustomerId, workshopId: context.workshopId, active: true }, select: { id: true } });
      if (!customer) throw new DomainError("Novo proprietário não encontrado.", 404, "CUSTOMER_NOT_FOUND");
      const activeOrder = await transaction.workOrder.findFirst({ where: { bikeId: id, workshopId: context.workshopId, status: { in: ["OPEN", "IN_PROGRESS", "READY"] } }, select: { number: true } });
      if (activeOrder) throw new DomainError(`Conclua ou cancele a OS #${activeOrder.number} antes da transferência.`, 409, "ACTIVE_WORK_ORDER");
      await transaction.bikeOwnershipTransfer.create({ data: { bikeId: id, oldCustomerId: bike.customerId, newCustomerId, changedById: context.userId, reason } });
      return transaction.bike.update({ where: { id }, data: { customerId: newCustomerId } });
    });
  },
};
