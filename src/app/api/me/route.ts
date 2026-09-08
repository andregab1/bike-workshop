import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/shared/http/errors";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ data: null });
    const memberships = await prisma.workshopMember.findMany({
      where: { userId: session.user.id, active: true },
      include: { workshop: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ data: { user: session.user, memberships } });
  } catch (error) { return errorResponse(error); }
}
