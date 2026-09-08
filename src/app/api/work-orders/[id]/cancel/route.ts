import { getRequestContext } from "@/lib/request-context";
import { cancelWorkOrderSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const input = cancelWorkOrderSchema.parse(await request.json()); return Response.json({ data: await workOrderService.cancel(await getRequestContext(), id, input.reason) }); } catch (error) { return errorResponse(error); } }
