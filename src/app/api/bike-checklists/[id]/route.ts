import { getRequestContext } from "@/lib/request-context";
import { bikeChecklistInputSchema } from "@/modules/checklists/schemas/bike-checklist";
import { bikeChecklistService } from "@/modules/checklists/services/bike-checklist-service";
import { errorResponse } from "@/shared/http/errors";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) { try { const context = await getRequestContext(); const { id } = await params; const input = bikeChecklistInputSchema.parse(await request.json()); return Response.json({ data: await bikeChecklistService.update(context, id, input) }); } catch (error) { return errorResponse(error); } }
export async function DELETE(_: Request, { params }: Params) { try { const context = await getRequestContext(); const { id } = await params; await bikeChecklistService.archive(context, id); return new Response(null, { status: 204 }); } catch (error) { return errorResponse(error); } }
