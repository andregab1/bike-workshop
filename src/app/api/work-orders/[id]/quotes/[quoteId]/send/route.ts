import { getRequestContext } from "@/lib/request-context";
import { workOrderQuoteService } from "@/modules/work-orders/services/work-order-quote-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  try { const { id, quoteId } = await params; return Response.json({ data: await workOrderQuoteService.send(await getRequestContext(), id, quoteId) }); }
  catch (error) { return errorResponse(error); }
}
