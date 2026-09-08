import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DomainError, errorResponse } from "@/shared/http/errors";

const schema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) });

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new DomainError("Faça login para continuar.", 401, "UNAUTHENTICATED");
    if (await prisma.workshop.count() > 0) throw new DomainError("BikeFlow já possui uma oficina configurada.", 403, "WORKSHOP_CREATION_CLOSED");
    const input = schema.parse(await request.json());
    const workshop = await prisma.$transaction(async (transaction) => {
      const created = await transaction.workshop.create({ data: { authOrganizationId: `local:${session.user.id}:${input.slug}`, name: input.name, slug: input.slug, members: { create: { userId: session.user.id, role: "OWNER" } } } });
      await transaction.user.update({ where: { id: session.user.id }, data: { activeWorkshopId: created.id } });
      return created;
    });
    return Response.json({ data: workshop }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
