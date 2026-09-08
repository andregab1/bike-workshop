import { getRequestContext } from "@/lib/request-context";
import { transferBikeSchema } from "@/modules/bikes/schemas/bike";
import { bikeService } from "@/modules/bikes/services/bike-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    const input = transferBikeSchema.parse(await request.json());
    return Response.json({ data: await bikeService.transfer(context, id, input.newCustomerId, input.reason) });
  } catch (error) {
    return errorResponse(error);
  }
}
