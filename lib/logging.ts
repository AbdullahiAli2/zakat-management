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

export async function logError(input: ErrorInput) {
  await prisma.audit.create({
    data: {
      userId: input.userId ?? null,
      action: "ERROR",
      module: "system",
      // Keep details in action/module/path fields since error_logs table was removed.
      path: input.path ?? null,
      operatingSystem: null,
      browser: null,
      ipAddress: null,
    },
  });
  await prisma.audit.create({
    data: {
      userId: input.userId ?? null,
      path: input.path ?? null,
      action: `${input.message}${input.lineNumber ? ` (line ${input.lineNumber})` : ""}`,
      module: input.stack ? input.stack.slice(0, 5000) : "no-stack",
    },
  });
}

