import { getRequestContext } from "@/lib/request-context";
import { customerService } from "@/modules/customers/services/customer-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    return Response.json({ data: await customerService.reactivate(context, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
