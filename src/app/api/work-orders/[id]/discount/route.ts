import { getRequestContext } from "@/lib/request-context";
import { workOrderDiscountSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderDiscountService } from "@/modules/work-orders/services/work-order-discount-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = workOrderDiscountSchema.parse(await request.json());
    await workOrderDiscountService.update(await getRequestContext(), id, input);
    return Response.json({ data: { updated: true } });
  } catch (error) { return errorResponse(error); }
}
