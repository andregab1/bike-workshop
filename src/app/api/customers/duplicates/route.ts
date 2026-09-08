import { getRequestContext } from "@/lib/request-context";
import { duplicateCustomerSchema } from "@/modules/customers/schemas/customer";
import { customerService } from "@/modules/customers/services/customer-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = duplicateCustomerSchema.parse(await request.json());
    return Response.json({ data: await customerService.findDuplicates(context, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
