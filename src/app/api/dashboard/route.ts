import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/shared/http/errors";

export async function GET() {
  try {
    const context = await getRequestContext(); const now = new Date();
    const [statusGroups, overdue, awaitingApproval, inventory, mechanicGroups] = await prisma.$transaction([
      prisma.workOrder.groupBy({ by: ["status"], where: { workshopId: context.workshopId }, orderBy: { status: "asc" }, _count: true }),
      prisma.workOrder.count({ where: { workshopId: context.workshopId, status: { in: ["OPEN", "IN_PROGRESS"] }, expectedDate: { lt: now } } }),
      prisma.workOrder.count({ where: { workshopId: context.workshopId, status: { in: ["OPEN", "IN_PROGRESS"] }, approvalStatus: "PENDING" } }),
      prisma.inventoryItem.findMany({ where: { workshopId: context.workshopId, active: true }, select: { quantity: true, reservedQuantity: true, minimumQuantity: true } }),
      prisma.workOrder.groupBy({ by: ["assignedMechanicId"], where: { workshopId: context.workshopId, status: "IN_PROGRESS", assignedMechanicId: { not: null } }, orderBy: { assignedMechanicId: "asc" }, _count: true }),
    ]);
    const memberIds = mechanicGroups.flatMap((group) => group.assignedMechanicId ? [group.assignedMechanicId] : []); const members = await prisma.workshopMember.findMany({ where: { id: { in: memberIds }, workshopId: context.workshopId }, include: { user: { select: { name: true } } } });
    const statuses = Object.fromEntries(statusGroups.map((group) => [group.status, group._count]));
    return Response.json({ data: { statuses, overdue, awaitingApproval, criticalStock: inventory.filter((item) => item.quantity.minus(item.reservedQuantity).lessThanOrEqualTo(item.minimumQuantity)).length, mechanics: mechanicGroups.map((group) => ({ memberId: group.assignedMechanicId, name: members.find((member) => member.id === group.assignedMechanicId)?.user.name || "Mecânico", inProgress: group._count })) } });
  } catch (error) { return errorResponse(error); }
}
