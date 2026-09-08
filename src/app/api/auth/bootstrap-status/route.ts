import { prisma } from "@/lib/prisma";

export async function GET() {
  const [userCount, workshopCount] = await prisma.$transaction([prisma.user.count(), prisma.workshop.count()]);
  return Response.json({ data: { registrationOpen: userCount === 0, workshopConfigured: workshopCount > 0 } });
}
