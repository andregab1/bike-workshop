import { getRequestContext } from "@/lib/request-context";
import { addMemberSchema } from "@/modules/team/schemas/team";
import { teamService } from "@/modules/team/services/team-service";
import { errorResponse } from "@/shared/http/errors";

export async function GET() {
  try {
    const context = await getRequestContext();
    return Response.json({ data: await teamService.list(context) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = addMemberSchema.parse(await request.json());
    return Response.json({ data: await teamService.add(context, input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
