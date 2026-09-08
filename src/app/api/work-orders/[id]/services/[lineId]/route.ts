import { getRequestContext } from "@/lib/request-context";
import { workOrderItemService } from "@/modules/work-orders/services/work-order-item-service";
import { updateWorkOrderLineSchema } from "@/modules/work-orders/schemas/work-order";
import { errorResponse } from "@/shared/http/errors";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try { const { id, lineId } = await params; return Response.json({ data: await workOrderItemService.removeService(await getRequestContext(), id, lineId) }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try { const { id, lineId } = await params; return Response.json({ data: await workOrderItemService.updateService(await getRequestContext(), id, lineId, updateWorkOrderLineSchema.parse(await request.json())) }); }
  catch (error) { return errorResponse(error); }
}
