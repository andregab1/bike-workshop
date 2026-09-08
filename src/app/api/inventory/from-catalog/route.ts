import { getRequestContext } from "@/lib/request-context";
import { createCatalogInventoryItemSchema } from "@/modules/inventory/schemas/inventory";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = createCatalogInventoryItemSchema.parse(await request.json());
    return Response.json({ data: await inventoryService.createFromCatalog(context, input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
