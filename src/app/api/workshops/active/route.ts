import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DomainError, errorResponse } from "@/shared/http/errors";

const schema = z.object({ workshopId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new DomainError("Faça login para continuar.", 401, "UNAUTHENTICATED");
    const { workshopId } = schema.parse(await request.json());
    const membership = await prisma.workshopMember.findFirst({ where: { userId: session.user.id, workshopId, active: true } });
    if (!membership) throw new DomainError("Oficina não encontrada.", 404, "WORKSHOP_NOT_FOUND");
    await prisma.user.update({ where: { id: session.user.id }, data: { activeWorkshopId: workshopId } });
    return Response.json({ data: { workshopId } });
  } catch (error) { return errorResponse(error); }
}
