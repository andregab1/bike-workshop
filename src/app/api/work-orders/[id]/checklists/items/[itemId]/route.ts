import { getRequestContext } from "@/lib/request-context";
import { checklistResultSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try { const { id, itemId } = await params; const input = checklistResultSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.updateChecklistItem(await getRequestContext(), id, itemId, input) }); }
  catch (error) { return errorResponse(error); }
}
