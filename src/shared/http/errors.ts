import { ZodError } from "zod";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Dados inválidos.", code: "VALIDATION_ERROR", issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof DomainError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return Response.json(
    { error: "Não foi possível concluir a operação.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
