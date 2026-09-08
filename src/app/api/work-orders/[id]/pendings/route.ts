import { getRequestContext } from "@/lib/request-context";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const order = await workOrderService.get(await getRequestContext(), id); return Response.json({ data: order.pendings }); }
  catch (error) { return errorResponse(error); }
}
