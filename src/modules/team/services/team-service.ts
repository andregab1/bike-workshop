import "server-only";

import { auth } from "@/lib/auth";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import type { AddMemberInput, UpdateMemberInput } from "@/modules/team/schemas/team";
import { assertCanGrantRole, assertCanManageMember } from "@/modules/team/team-policy";
import { requirePermission } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

const memberInclude = { user: { select: { id: true, name: true, email: true } } } as const;

export const teamService = {
  async list(context: RequestContext) {
    const members = await prisma.workshopMember.findMany({
      where: { workshopId: context.workshopId },
      include: memberInclude,
      orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    });
    const audits = await prisma.auditLog.findMany({ where: { workshopId: context.workshopId, entityType: "WorkshopMember", entityId: { in: members.map((member) => member.id) }, action: { in: ["TEAM_MEMBER_ADDED", "TEAM_MEMBER_UPDATED"] } }, orderBy: { createdAt: "desc" }, select: { entityId: true, actorUserId: true, createdAt: true } });
    const latest = new Map<string, (typeof audits)[number]>();
    for (const audit of audits) if (!latest.has(audit.entityId)) latest.set(audit.entityId, audit);
    const editors = await prisma.user.findMany({ where: { id: { in: [...new Set(audits.map((audit) => audit.actorUserId))] } }, select: { id: true, name: true } });
    const names = new Map(editors.map((user) => [user.id, user.name]));
    return members.map((member) => { const audit = latest.get(member.id); return { ...member, lastEditedBy: audit ? names.get(audit.actorUserId) || "Conta removida" : null, lastEditedAt: audit?.createdAt || null }; });
  },

  async add(context: RequestContext, input: AddMemberInput) {
    requirePermission(context, "MANAGE_USERS");
    assertCanGrantRole(context, input.role);

    let user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      if (!input.name || !input.password) {
        throw new DomainError("Usuário inexistente. Informe nome e senha inicial para criar a conta.", 404, "USER_CREATION_DATA_REQUIRED");
      }
      const result = await auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password, rememberMe: false } });
      user = await prisma.user.findUnique({ where: { id: result.user.id } });
    }
    if (!user) throw new DomainError("Não foi possível criar o usuário.", 500, "USER_CREATION_FAILED");

    return prisma.$transaction(async (transaction) => {
      const member = await transaction.workshopMember.upsert({
        where: { workshopId_userId: { workshopId: context.workshopId, userId: user.id } },
        create: { workshopId: context.workshopId, userId: user.id, role: input.role },
        update: { role: input.role, active: true },
        include: memberInclude,
      });
      await transaction.auditLog.create({ data: { workshopId: context.workshopId, actorUserId: context.userId, action: "TEAM_MEMBER_ADDED", entityType: "WorkshopMember", entityId: member.id, metadata: { userId: user.id, role: input.role, active: true } } });
      return member;
    });
  },

  async update(context: RequestContext, id: string, input: UpdateMemberInput) {
    requirePermission(context, "MANAGE_USERS");
    return prisma.$transaction(async (transaction) => {
      const member = await transaction.workshopMember.findFirst({ where: { id, workshopId: context.workshopId } });
      if (!member) throw new DomainError("Membro não encontrado.", 404, "MEMBER_NOT_FOUND");
      assertCanManageMember(context, member, input);
      if (input.role) assertCanGrantRole(context, input.role);

      const removesOwner = member.role === "OWNER" && (input.active === false || (input.role && input.role !== "OWNER"));
      if (removesOwner) {
        const activeOwners = await transaction.workshopMember.count({ where: { workshopId: context.workshopId, role: "OWNER", active: true } });
        if (activeOwners <= 1) throw new DomainError("A oficina precisa manter ao menos um proprietário ativo.", 409, "LAST_OWNER");
      }

      if (input.name) await transaction.user.update({ where: { id: member.userId }, data: { name: input.name } });
      const updated = await transaction.workshopMember.update({ where: { id: member.id }, data: { role: input.role, active: input.active }, include: memberInclude });
      const audit = await transaction.auditLog.create({ data: { workshopId: context.workshopId, actorUserId: context.userId, action: "TEAM_MEMBER_UPDATED", entityType: "WorkshopMember", entityId: member.id, metadata: { before: { role: member.role, active: member.active }, after: { role: updated.role, active: updated.active, name: updated.user.name } } } });
      const editor = await transaction.user.findUnique({ where: { id: context.userId }, select: { name: true } });
      return { ...updated, lastEditedBy: editor?.name || "Conta removida", lastEditedAt: audit.createdAt };
    }, { isolationLevel: "Serializable" });
  },
};
