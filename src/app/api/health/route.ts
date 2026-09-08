import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      database: "connected",
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
