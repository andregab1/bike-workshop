import { getRequestContext } from "@/lib/request-context";
import { updateBikeSchema } from "@/modules/bikes/schemas/bike";
import { bikeService } from "@/modules/bikes/services/bike-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    return Response.json({ data: await bikeService.get(context, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    const input = updateBikeSchema.parse(await request.json());
    return Response.json({ data: await bikeService.update(context, id, input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    await bikeService.archive(context, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
