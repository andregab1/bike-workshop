import type { WorkOrderAttachmentType } from "@/generated/prisma/enums";
import { getRequestContext } from "@/lib/request-context";
import { workOrderAttachmentService } from "@/modules/work-orders/services/work-order-attachment-service";
import { errorResponse } from "@/shared/http/errors";

const types = new Set(["ENTRY", "DIAGNOSIS", "SERVICE", "DAMAGE", "DELIVERY", "GENERAL"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const form = await request.formData(); const file = form.get("file"); const type = String(form.get("type") || "GENERAL"); const description = String(form.get("description") || "").trim();
    if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo.", code: "FILE_REQUIRED" }, { status: 400 });
    if (!types.has(type)) return Response.json({ error: "Tipo de anexo inválido.", code: "INVALID_ATTACHMENT_TYPE" }, { status: 400 });
    return Response.json({ data: await workOrderAttachmentService.create(await getRequestContext(), id, { file, type: type as WorkOrderAttachmentType, description: description || undefined }) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
