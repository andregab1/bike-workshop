import { getRequestContext } from "@/lib/request-context";
import { workOrderAttachmentService } from "@/modules/work-orders/services/work-order-attachment-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try { const { id, attachmentId } = await params; const { attachment, bytes } = await workOrderAttachmentService.read(await getRequestContext(), id, attachmentId); return new Response(bytes, { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return errorResponse(error); }
}
