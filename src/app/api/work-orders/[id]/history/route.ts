import { getRequestContext } from "@/lib/request-context";
import { workOrderHistoryQuerySchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderService } from "@/modules/work-orders/services/work-order-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const url = new URL(request.url); const query = workOrderHistoryQuerySchema.parse(Object.fromEntries(url.searchParams)); return Response.json({ data: await workOrderService.history(await getRequestContext(), id, query.page, query.pageSize) }); }
  catch (error) { return errorResponse(error); }
}
