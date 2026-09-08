import { getRequestContext } from "@/lib/request-context";
import { updateChecklistTemplateSchema } from "@/modules/checklists/schemas/checklist-template";
import { checklistTemplateService } from "@/modules/checklists/services/checklist-template-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(); const { id } = await params; const input = updateChecklistTemplateSchema.parse(await request.json());
    return Response.json({ data: await checklistTemplateService.update(context, id, input) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(); const { id } = await params;
    return Response.json({ data: await checklistTemplateService.update(context, id, { active: false }) });
  } catch (error) { return errorResponse(error); }
}
