import { getRequestContext } from "@/lib/request-context";
import { bikeChecklistInputSchema } from "@/modules/checklists/schemas/bike-checklist";
import { bikeChecklistService } from "@/modules/checklists/services/bike-checklist-service";
import { errorResponse } from "@/shared/http/errors";
export async function GET() { try { const context = await getRequestContext(); return Response.json({ data: await bikeChecklistService.list(context) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const context = await getRequestContext(); const input = bikeChecklistInputSchema.parse(await request.json()); return Response.json({ data: await bikeChecklistService.create(context, input) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
