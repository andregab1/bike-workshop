import { getRequestContext } from "@/lib/request-context";
import { customerContactSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const input = customerContactSchema.parse(await request.json()); return Response.json({ data: await workOrderService.registerContact(await getRequestContext(), id, input.message) }); } catch (error) { return errorResponse(error); } }
