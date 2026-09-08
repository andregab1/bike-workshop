import { getRequestContext } from "@/lib/request-context";
import { quoteDecisionSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderQuoteService } from "@/modules/work-orders/services/work-order-quote-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  try { const { id, quoteId } = await params; const input = quoteDecisionSchema.parse(await request.json()); return Response.json({ data: await workOrderQuoteService.decide(await getRequestContext(), id, quoteId, "REJECTED", input) }); }
  catch (error) { return errorResponse(error); }
}
