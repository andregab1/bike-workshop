import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DomainError, errorResponse } from "@/shared/http/errors";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/sign-up/email") && await prisma.user.count() > 0) {
    return errorResponse(new DomainError("Cadastro público encerrado. Solicite acesso ao responsável da oficina.", 403, "REGISTRATION_CLOSED"));
  }
  return handler.POST(request);
}
