import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { WorkshopRole } from "@/generated/prisma/enums";
import { DomainError } from "@/shared/http/errors";

export type RequestContext = {
  userId: string;
  workshopId: string;
  memberId: string;
  role: WorkshopRole;
};

export async function getRequestContext(): Promise<RequestContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new DomainError("Faça login para continuar.", 401, "UNAUTHENTICATED");

  const preferredWorkshopId = session.user.activeWorkshopId;
  const membership = await prisma.workshopMember.findFirst({
    where: {
      userId: session.user.id,
      active: true,
      ...(preferredWorkshopId ? { workshopId: preferredWorkshopId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, workshopId: true, role: true },
  }) ?? (preferredWorkshopId
    ? await prisma.workshopMember.findFirst({
        where: { userId: session.user.id, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, workshopId: true, role: true },
      })
    : null);

  if (!membership) throw new DomainError("Usuário sem oficina ativa.", 403, "WORKSHOP_REQUIRED");

  return {
    userId: session.user.id,
    memberId: membership.id,
    workshopId: membership.workshopId,
    role: membership.role,
  };
}
