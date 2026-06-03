import { prisma } from "./db";
import { UAParser } from "ua-parser-js";

type AuditInput = {
  userId?: number | null;
  path: string;
  action: string;
  module: string;
  ip?: string | null;
  userAgent?: string | null;
};

export function parseBrowserOs(userAgent?: string | null) {
  const ua = userAgent ?? "";
  const parsed = new UAParser(ua).getResult();
  const browser = parsed.browser?.name ?? "Unknown";
  const os = parsed.os?.name ?? "Unknown";
  return { browser, os };
}

export async function logAudit(input: AuditInput) {
  const { browser, os } = parseBrowserOs(input.userAgent);
  await prisma.audit.create({
    data: {
      userId: input.userId ?? null,
      path: input.path,
      action: input.action,
      module: input.module,
      ipAddress: input.ip ?? "",
      browser,
      operatingSystem: os,
    },
  });
}

type ErrorInput = {
  userId?: number | null;
  message: string;
  stack?: string;
  lineNumber?: number | null;
  path?: string | null;
};

/** Server-side diagnostic only — failures are not written to the audit trail. */
export async function logError(input: ErrorInput) {
  if (process.env.NODE_ENV === "development") {
    const line = input.lineNumber ? ` (line ${input.lineNumber})` : "";
    console.error(`[api] ${input.path ?? "?"} — ${input.message}${line}`);
    if (input.stack) console.error(input.stack);
  }
}

