import { getRequestContext } from "@/lib/request-context";
import { createBikeSchema } from "@/modules/bikes/schemas/bike";
import { bikeService } from "@/modules/bikes/services/bike-service";
import { errorResponse } from "@/shared/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id: customerId } = await params;
    const input = createBikeSchema.parse(await request.json());
    const bike = await bikeService.create(context, customerId, input);
    return Response.json({ data: bike }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
