import { getRequestContext } from "@/lib/request-context";
import { batchPhysicalCountSchema } from "@/modules/inventory/schemas/inventory";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = batchPhysicalCountSchema.parse(await request.json());
    return Response.json({ data: await inventoryService.batchPhysicalCount(context, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
