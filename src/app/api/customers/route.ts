import { getRequestContext } from "@/lib/request-context";
import { createCustomerSchema } from "@/modules/customers/schemas/customer";
import { customerService } from "@/modules/customers/services/customer-service";
import { errorResponse } from "@/shared/http/errors";
import { z } from "zod";

const listCustomerSchema = z.object({
  q: z.string().trim().max(120).optional(),
  active: z.enum(["true", "false", "all"]).default("true"),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext();
    const query = listCustomerSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const active = query.active === "all" ? "all" : query.active === "true";
    return Response.json({ data: await customerService.list(context, query.q, active) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext();
    const input = createCustomerSchema.parse(await request.json());
    const customer = await customerService.create(context, input);
    return Response.json({ data: customer }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
