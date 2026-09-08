import { getRequestContext } from "@/lib/request-context";
import { createWorkOrderSchema, workOrderListQuerySchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request) { try { const query = workOrderListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); return Response.json({ data: await workOrderService.list(await getRequestContext(), query) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const context = await getRequestContext(); const input = createWorkOrderSchema.parse(await request.json()); return Response.json({ data: await workOrderService.create(context, input) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
