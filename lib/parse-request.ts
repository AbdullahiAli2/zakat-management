import type { ZodType } from "zod";
import type { ZodError } from "zod";
import { validationErrorBody, type ValidationErrorBody } from "./validation-messages";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: ValidationErrorBody };

export function parseRequestBody<T>(schema: ZodType<T>, body: unknown, status = 400): ParseResult<T> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, status, body: validationErrorBody(parsed.error) };
}

export function parseRequestQuery<T>(schema: ZodType<T>, query: unknown, status = 400): ParseResult<T> {
  return parseRequestBody(schema, query, status);
}

export function isZodError(err: unknown): err is ZodError {
  return Boolean(err && typeof err === "object" && (err as ZodError).name === "ZodError");
}

export function zodErrorBody(err: ZodError, status = 400): { status: number; body: ValidationErrorBody } {
  return { status, body: validationErrorBody(err) };
}
