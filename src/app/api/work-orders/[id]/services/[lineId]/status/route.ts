import { getRequestContext } from "@/lib/request-context";
import { workOrderLineStatusSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try { const { id, lineId } = await params; const input = workOrderLineStatusSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.updateServiceStatus(await getRequestContext(), id, lineId, input.status, input.notes) }); }
  catch (error) { return errorResponse(error); }
}
