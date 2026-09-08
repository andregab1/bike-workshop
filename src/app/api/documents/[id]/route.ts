import { getRequestContext } from "@/lib/request-context";
import { documentService } from "@/modules/documents/services/document-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const { document, bytes } = await documentService.read(await getRequestContext(), id); return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename=\"${document.type.toLowerCase()}-v${document.version}.pdf\"`, "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); } }
