import { getRequestContext } from "@/lib/request-context";
import { updateMemberSchema } from "@/modules/team/schemas/team";
import { teamService } from "@/modules/team/services/team-service";
import { errorResponse } from "@/shared/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext();
    const { id } = await params;
    const input = updateMemberSchema.parse(await request.json());
    return Response.json({ data: await teamService.update(context, id, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
