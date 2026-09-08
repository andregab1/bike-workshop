import { getRequestContext } from "@/lib/request-context";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return Response.json({ data: await workOrderOperationService.resume(await getRequestContext(), id) }); }
  catch (error) { return errorResponse(error); }
}
