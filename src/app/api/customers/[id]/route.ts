import { getRequestContext } from "@/lib/request-context";
import { updateCustomerSchema } from "@/modules/customers/schemas/customer";
import { customerService } from "@/modules/customers/services/customer-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    return Response.json({ data: await customerService.get(context, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    const input = updateCustomerSchema.parse(await request.json());
    return Response.json({ data: await customerService.update(context, id, input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    await customerService.archive(context, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
