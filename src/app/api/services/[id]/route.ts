import { getRequestContext } from "@/lib/request-context";
import { updateServiceCatalogSchema } from "@/modules/services/schemas/service-catalog";
import { serviceCatalogService } from "@/modules/services/services/service-catalog-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(); const { id } = await params;
    const input = updateServiceCatalogSchema.parse(await request.json());
    return Response.json({ data: await serviceCatalogService.update(context, id, input) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(); const { id } = await params;
    return Response.json({ data: await serviceCatalogService.update(context, id, { active: false }) });
  } catch (error) { return errorResponse(error); }
}
