import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { documentService } from "@/modules/documents/services/document-service";
import { errorResponse } from "@/shared/http/errors";

const schema = z.object({ type: z.enum(["QUOTE", "WORK_ORDER", "PICKUP_RECEIPT"]) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const { type } = schema.parse(await request.json()); return Response.json({ data: await documentService.generate(await getRequestContext(), id, type) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
