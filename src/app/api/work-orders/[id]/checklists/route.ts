import { getRequestContext } from "@/lib/request-context";
import { applyWorkOrderChecklistSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = applyWorkOrderChecklistSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.applyChecklist(await getRequestContext(), id, input) }, { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
