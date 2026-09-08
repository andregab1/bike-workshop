import { getRequestContext } from "@/lib/request-context";
import { pauseExecutionSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = pauseExecutionSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.pause(await getRequestContext(), id, input.reason) }); }
  catch (error) { return errorResponse(error); }
}
