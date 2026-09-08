import { getRequestContext } from "@/lib/request-context";
import { addWorkOrderServiceSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderItemService } from "@/modules/work-orders/services/work-order-item-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = addWorkOrderServiceSchema.parse(await request.json()); return Response.json({ data: await workOrderItemService.addService(await getRequestContext(), id, input) }, { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
