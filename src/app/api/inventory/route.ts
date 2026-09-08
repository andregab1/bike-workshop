import { getRequestContext } from "@/lib/request-context";
import { createCustomInventoryItemSchema, inventoryListQuerySchema } from "@/modules/inventory/schemas/inventory";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(); const params = new URL(request.url).searchParams;
    const query = inventoryListQuerySchema.parse(Object.fromEntries(params.entries()));
    return Response.json({ data: await inventoryService.list(context, query) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(); const input = createCustomInventoryItemSchema.parse(await request.json());
    return Response.json({ data: await inventoryService.createCustom(context, input) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
