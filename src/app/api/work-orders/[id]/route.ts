import { getRequestContext } from "@/lib/request-context";
import { updateWorkOrderSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return Response.json({ data: await workOrderService.get(await getRequestContext(), id) }); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const input = updateWorkOrderSchema.parse(await request.json()); return Response.json({ data: await workOrderService.update(await getRequestContext(), id, input) }); } catch (error) { return errorResponse(error); } }
