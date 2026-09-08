import { getRequestContext } from "@/lib/request-context";
import { quoteCreateSchema } from "@/modules/work-orders/schemas/work-order";
import { workOrderQuoteService } from "@/modules/work-orders/services/work-order-quote-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const input = quoteCreateSchema.parse(await request.json()); return Response.json({ data: await workOrderQuoteService.generate(await getRequestContext(), id, input) }, { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
