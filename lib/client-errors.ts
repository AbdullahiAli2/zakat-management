import { toast } from "sonner";
import type { ZodError } from "zod";
import {
  firstZodErrorMessage,
  resolveFriendlyError,
  zodFieldErrors,
  type ValidationErrorBody,
} from "./validation-messages";

type RtkError = {
  data?: ValidationErrorBody & { error?: string; details?: unknown };
};

export function getApiFieldErrors(err: unknown): Record<string, string> {
  const data = extractErrorPayload(err);
  if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) return data.fieldErrors;
  return {};
}

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = extractErrorPayload(err);
  if (data) return resolveFriendlyError(data, fallback);
  if (err instanceof Error && err.message) return resolveFriendlyError({ error: err.message }, err.message);
  return fallback;
}

export function toastApiError(err: unknown, fallback?: string) {
  toast.error(getApiErrorMessage(err, fallback));
}

export function toastFetchError(json: unknown, fallback?: string) {
  toast.error(resolveFriendlyError(json, fallback ?? "Request failed. Please try again."));
}

export function formatZodFieldErrors(error: ZodError): Record<string, string> {
  return zodFieldErrors(error);
}

export function toastZodError(error: ZodError) {
  toast.error(firstZodErrorMessage(error));
}

function extractErrorPayload(err: unknown): (ValidationErrorBody & { error?: string }) | undefined {
  if (!err || typeof err !== "object") return undefined;
  const rtk = err as RtkError;
  if (rtk.data && typeof rtk.data === "object") return rtk.data;
  return err as ValidationErrorBody & { error?: string };
}
