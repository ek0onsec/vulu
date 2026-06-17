import { NextResponse } from "next/server";
import { ZodError, flattenError } from "zod";
import { DomainError } from "@/server/domain/errors";

const STATUS: Record<string, number> = { NOT_FOUND: 404, CONFLICT: 409, AUTH: 401, VALIDATION: 422, FORBIDDEN: 403 };

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION", details: flattenError(err) }, { status: 422 });
  }
  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: STATUS[err.code] ?? 400 });
  }
  console.error("Erreur inattendue:", err);
  return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
}
