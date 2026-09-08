import { getRequestContext } from "@/lib/request-context";
import { updateInventoryItemSchema } from "@/modules/inventory/schemas/inventory";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await getRequestContext(); const { id } = await params; return Response.json({ data: await inventoryService.get(context, id) }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await getRequestContext(); const { id } = await params; const input = updateInventoryItemSchema.parse(await request.json()); return Response.json({ data: await inventoryService.update(context, id, input) }); }
  catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await getRequestContext(); const { id } = await params; return Response.json({ data: await inventoryService.deactivate(context, id) }); }
  catch (error) { return errorResponse(error); }
}
