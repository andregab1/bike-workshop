import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/shared/http/errors";

const schema = z.object({ q: z.string().trim().min(2).max(120) });
export async function GET(request: Request) {
  try {
    const context = await getRequestContext(); const { q } = schema.parse(Object.fromEntries(new URL(request.url).searchParams)); const numeric = /^#?(\d+)$/.exec(q);
    const [customers, bikes, workOrders, inventory] = await prisma.$transaction([
      prisma.customer.findMany({ where: { workshopId: context.workshopId, active: true, OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { cpfCnpj: { contains: q } }] }, select: { id: true, name: true, phone: true }, take: 5 }),
      prisma.bike.findMany({ where: { workshopId: context.workshopId, active: true, OR: [{ brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }, { serialNumber: { contains: q, mode: "insensitive" } }] }, select: { id: true, brand: true, model: true, customerId: true }, take: 5 }),
      prisma.workOrder.findMany({ where: { workshopId: context.workshopId, ...(numeric ? { number: Number(numeric[1]) } : { bike: { customer: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } } } }) }, select: { id: true, number: true, status: true }, take: 5 }),
      prisma.inventoryItem.findMany({ where: { workshopId: context.workshopId, active: true, OR: [{ customName: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { ean: { contains: q } }, { catalogPart: { is: { searchText: { contains: q, mode: "insensitive" } } } }] }, select: { id: true, customName: true, sku: true, ean: true, catalogPart: { select: { name: true } } }, take: 5 }),
    ]);
    return Response.json({ data: { customers, bikes, workOrders, inventory } });
  } catch (error) { return errorResponse(error); }
}
