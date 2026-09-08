import { getRequestContext } from "@/lib/request-context";
import { serviceCatalogInputSchema, serviceCatalogQuerySchema } from "@/modules/services/schemas/service-catalog";
import { serviceCatalogService } from "@/modules/services/services/service-catalog-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext();
    const url = new URL(request.url);
    const query = serviceCatalogQuerySchema.parse({ q: url.searchParams.get("q") || undefined, active: url.searchParams.get("active") || undefined });
    return Response.json({ data: await serviceCatalogService.list(context, query.q, query.active) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = serviceCatalogInputSchema.parse(await request.json());
    return Response.json({ data: await serviceCatalogService.create(context, input) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
