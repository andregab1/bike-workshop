import { getRequestContext } from "@/lib/request-context";
import { bikeChecklistService } from "@/modules/checklists/services/bike-checklist-service";
import { errorResponse } from "@/shared/http/errors";
export async function GET() { try { const context = await getRequestContext(); return Response.json({ data: await bikeChecklistService.suggestions(context) }); } catch (error) { return errorResponse(error); } }
