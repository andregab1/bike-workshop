import { getRequestContext } from "@/lib/request-context";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request) {
  try { const context = await getRequestContext(); const inventoryItemId = new URL(request.url).searchParams.get("inventoryItemId") || undefined; return Response.json({ data: await inventoryService.movements(context, inventoryItemId) }); }
  catch (error) { return errorResponse(error); }
}
