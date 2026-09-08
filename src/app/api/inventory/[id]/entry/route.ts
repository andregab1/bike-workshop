import { getRequestContext } from "@/lib/request-context";
import { stockEntrySchema } from "@/modules/inventory/schemas/inventory";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await getRequestContext(); const { id } = await params; const input = stockEntrySchema.parse(await request.json()); return Response.json({ data: await inventoryService.entry(context, id, input) }); }
  catch (error) { return errorResponse(error); }
}
