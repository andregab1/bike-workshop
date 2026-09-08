import { getRequestContext } from "@/lib/request-context";
import { quoteDecisionCommandSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderQuoteService } from "@/modules/work-orders/services/work-order-quote-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { quoteId, decision, ...input } = quoteDecisionCommandSchema.parse(await request.json());
    return Response.json({ data: await workOrderQuoteService.decide(await getRequestContext(), id, quoteId, decision, input) });
  } catch (error) { return errorResponse(error); }
}
