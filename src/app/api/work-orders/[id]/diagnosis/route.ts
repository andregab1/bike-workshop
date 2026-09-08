import { getRequestContext } from "@/lib/request-context";
import { diagnosisCommandSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderOperationService } from "@/modules/work-orders/services/work-order-operation-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = diagnosisCommandSchema.parse(await request.json()); return Response.json({ data: await workOrderOperationService.updateDiagnosis(await getRequestContext(), id, input) }); }
  catch (error) { return errorResponse(error); }
}
