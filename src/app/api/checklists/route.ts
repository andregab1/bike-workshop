import { getRequestContext } from "@/lib/request-context";
import { checklistTemplateInputSchema } from "@/modules/checklists/schemas/checklist-template";
import { checklistTemplateService } from "@/modules/checklists/services/checklist-template-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(); const active = new URL(request.url).searchParams.get("active") !== "false";
    return Response.json({ data: await checklistTemplateService.list(context, active) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(); const input = checklistTemplateInputSchema.parse(await request.json());
    return Response.json({ data: await checklistTemplateService.create(context, input) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
