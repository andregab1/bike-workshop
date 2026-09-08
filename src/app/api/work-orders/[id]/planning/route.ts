import { getRequestContext } from "@/lib/request-context";
import { workOrderPlanningSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = workOrderPlanningSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.updatePlanning(await getRequestContext(), id, input) }); }
  catch (error) { return errorResponse(error); }
}
