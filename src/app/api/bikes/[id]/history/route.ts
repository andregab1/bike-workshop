import { getRequestContext } from "@/lib/request-context";
import { bikeService } from "@/modules/bikes/services/bike-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    return Response.json({ data: await bikeService.history(context, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
