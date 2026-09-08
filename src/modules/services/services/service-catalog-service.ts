import "server-only";

import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import type { ServiceCatalogInput, UpdateServiceCatalogInput } from "@/modules/services/schemas/service-catalog";
import { requireOwner } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

async function findOwned(context: RequestContext, id: string) {
  const item = await prisma.serviceCatalogItem.findFirst({ where: { id, workshopId: context.workshopId } });
  if (!item) throw new DomainError("Serviço não encontrado.", 404, "SERVICE_NOT_FOUND");
  return item;
}

export const serviceCatalogService = {
  list(context: RequestContext, query?: string, active: "true" | "false" | "all" = "true") {
    return prisma.serviceCatalogItem.findMany({
      where: {
        workshopId: context.workshopId,
        ...(active === "all" ? {} : { active: active === "true" }),
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  },

  create(context: RequestContext, input: ServiceCatalogInput) {
    requireOwner(context);
    return prisma.serviceCatalogItem.create({ data: { ...input, workshopId: context.workshopId } });
  },

  async update(context: RequestContext, id: string, input: UpdateServiceCatalogInput) {
    requireOwner(context); await findOwned(context, id);
    return prisma.serviceCatalogItem.update({ where: { id }, data: input });
  },
};
