import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import type { JournalReferenceType } from "./constants";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export type JournalLineInput = {
  accountId: number;
  walletId?: number | null;
  debit?: number;
  credit?: number;
  lineDescription?: string;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function validateDoubleEntry(lines: JournalLineInput[]) {
  if (lines.length < 2) {
    throw Object.assign(new Error("Journal entry requires at least two lines"), { status: 400 });
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const debit = roundMoney(line.debit ?? 0);
    const credit = roundMoney(line.credit ?? 0);
    if (debit < 0 || credit < 0) throw Object.assign(new Error("Debit and credit must be non-negative"), { status: 400 });
    if (debit > 0 && credit > 0) throw Object.assign(new Error("A line cannot have both debit and credit"), { status: 400 });
    if (debit === 0 && credit === 0) throw Object.assign(new Error("Each line must have a debit or credit amount"), { status: 400 });
    totalDebit += debit;
    totalCredit += credit;
  }

  if (roundMoney(totalDebit) !== roundMoney(totalCredit)) {
    throw Object.assign(new Error("Journal entry is not balanced (debits must equal credits)"), { status: 400 });
  }

  return { totalDebit: roundMoney(totalDebit), totalCredit: roundMoney(totalCredit) };
}

async function nextEntryNumber(client: DbClient) {
  const rows = await client.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    "SELECT COUNT(*) AS n FROM journal_entries WHERE DATE(entry_date) = CURDATE()",
  );
  const seq = Number(rows[0]?.n ?? 0) + 1;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `JE-${date}-${String(seq).padStart(5, "0")}`;
}

export async function postJournalEntry(
  client: DbClient,
  input: {
    description: string;
    referenceType: JournalReferenceType;
    referenceId?: number | null;
    postedBy?: number | null;
    lines: JournalLineInput[];
  },
) {
  validateDoubleEntry(input.lines);
  const entryNumber = await nextEntryNumber(client);

  await client.$executeRawUnsafe(
    `INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, status, posted_by, posted_at, created_at)
     VALUES (?, NOW(), ?, ?, ?, 'POSTED', ?, NOW(), NOW())`,
    entryNumber,
    input.description,
    input.referenceType,
    input.referenceId ?? null,
    input.postedBy ?? null,
  );

  const entryRows = await client.$queryRawUnsafe<Array<{ id: number }>>("SELECT LAST_INSERT_ID() AS id");
  const journalEntryId = entryRows[0]?.id;
  if (!journalEntryId) throw Object.assign(new Error("Failed to create journal entry"), { status: 500 });

  for (const line of input.lines) {
    await client.$executeRawUnsafe(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, wallet_id, debit, credit, line_description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      journalEntryId,
      line.accountId,
      line.walletId ?? null,
      roundMoney(line.debit ?? 0),
      roundMoney(line.credit ?? 0),
      line.lineDescription ?? null,
    );
  }

  return { journalEntryId, entryNumber };
}

export async function reverseJournalEntry(
  client: DbClient,
  input: { journalEntryId: number; reversedBy: number; reason?: string },
) {
  const entryRows = await client.$queryRawUnsafe<
    Array<{ id: number; status: string; reference_type: string; reference_id: number | null; description: string | null }>
  >("SELECT id, status, reference_type, reference_id, description FROM journal_entries WHERE id = ? LIMIT 1", input.journalEntryId);
  const entry = entryRows[0];
  if (!entry) throw Object.assign(new Error("Journal entry not found"), { status: 404 });
  if (entry.status !== "POSTED") throw Object.assign(new Error("Only posted entries can be reversed"), { status: 400 });

  const lineRows = await client.$queryRawUnsafe<
    Array<{ account_id: number; wallet_id: number | null; debit: number | string; credit: number | string; line_description: string | null }>
  >("SELECT account_id, wallet_id, debit, credit, line_description FROM journal_entry_lines WHERE journal_entry_id = ?", input.journalEntryId);

  const reversalLines: JournalLineInput[] = lineRows.map((l) => ({
    accountId: l.account_id,
    walletId: l.wallet_id,
    debit: Number(l.credit),
    credit: Number(l.debit),
    lineDescription: l.line_description ? `Reversal: ${l.line_description}` : "Reversal",
  }));

  const reversal = await postJournalEntry(client, {
    description: input.reason ?? `Reversal of ${entry.description ?? `JE #${entry.id}`}`,
    referenceType: entry.reference_type as JournalReferenceType,
    referenceId: entry.reference_id,
    postedBy: input.reversedBy,
    lines: reversalLines,
  });

  await client.$executeRawUnsafe(
    "UPDATE journal_entries SET status = 'REVERSED', reversed_by = ?, reversed_at = NOW() WHERE id = ?",
    input.reversedBy,
    input.journalEntryId,
  );

  return reversal;
}

export async function getJournalEntryByReference(
  client: DbClient,
  referenceType: JournalReferenceType,
  referenceId: number,
) {
  const rows = await client.$queryRawUnsafe<Array<{ id: number; entry_number: string; status: string }>>(
    `SELECT id, entry_number, status FROM journal_entries
     WHERE reference_type = ? AND reference_id = ? AND status = 'POSTED'
     ORDER BY id DESC LIMIT 1`,
    referenceType,
    referenceId,
  );
  return rows[0] ?? null;
}
