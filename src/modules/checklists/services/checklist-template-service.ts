import "server-only";

import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import type { ChecklistTemplateInput, UpdateChecklistTemplateInput } from "@/modules/checklists/schemas/checklist-template";
import { requireOwner } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

const includeItems = { items: { orderBy: { sortOrder: "asc" as const } } };

async function findOwned(context: RequestContext, id: string) {
  const template = await prisma.checklistTemplate.findFirst({ where: { id, workshopId: context.workshopId }, include: includeItems });
  if (!template) throw new DomainError("Checklist não encontrado.", 404, "CHECKLIST_NOT_FOUND");
  return template;
}

export const checklistTemplateService = {
  list(context: RequestContext, active = true) {
    return prisma.checklistTemplate.findMany({ where: { workshopId: context.workshopId, active }, include: includeItems, orderBy: { name: "asc" } });
  },

  create(context: RequestContext, input: ChecklistTemplateInput) {
    requireOwner(context);
    return prisma.checklistTemplate.create({
      data: { workshopId: context.workshopId, name: input.name, description: input.description, items: { create: input.items.map((item, sortOrder) => ({ ...item, sortOrder })) } },
      include: includeItems,
    });
  },

  async update(context: RequestContext, id: string, input: UpdateChecklistTemplateInput) {
    requireOwner(context); await findOwned(context, id);
    return prisma.$transaction(async (transaction) => {
      if (input.items) await transaction.checklistTemplateItem.deleteMany({ where: { templateId: id } });
      return transaction.checklistTemplate.update({
        where: { id },
        data: { name: input.name, description: input.description, active: input.active, ...(input.items ? { items: { create: input.items.map((item, sortOrder) => ({ ...item, sortOrder })) } } : {}) },
        include: includeItems,
      });
    });
  },
};
