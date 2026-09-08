import { getRequestContext } from "@/lib/request-context";
import { reopenCompletedWorkOrderSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    const { reason } = reopenCompletedWorkOrderSchema.parse(await request.json());
    return Response.json({ data: await workOrderService.reopenCompleted(context, id, reason) });
  } catch (error) {
    return errorResponse(error);
  }
}
