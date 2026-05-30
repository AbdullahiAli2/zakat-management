import type { DbClient } from "./journal";
import { getAccountByCode } from "./chart-of-accounts";
import { postJournalEntry, getJournalEntryByReference, reverseJournalEntry } from "./journal";
import { getWalletByType, getWalletBalance } from "./wallets";
import { GL } from "./constants";
import type { WalletType } from "./constants";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Zakat collection: Dr Zakat Pool Cash, Cr Zakat Income */
export async function postZakatCollectionJournal(
  client: DbClient,
  input: {
    paymentId: number;
    amount: number;
    transactionId: number;
    postedBy: number;
    walletType?: WalletType;
  },
) {
  const existing = await getJournalEntryByReference(client, "ZAKAT_PAYMENT", input.paymentId);
  if (existing) return { journalEntryId: existing.id, entryNumber: existing.entry_number, skipped: true as const };

  const wallet = await getWalletByType(input.walletType ?? "ZAKAT", client);
  if (!wallet || wallet.status !== "ACTIVE") {
    throw Object.assign(new Error("Zakat wallet is not available"), { status: 400 });
  }

  const cashAccount = await getAccountByCode(client, GL.ZAKAT_CASH);
  const incomeAccount = await getAccountByCode(client, GL.ZAKAT_INCOME);
  if (!cashAccount || !incomeAccount) {
    throw Object.assign(new Error("Required GL accounts are not configured"), { status: 500 });
  }

  const amount = roundMoney(input.amount);
  const { journalEntryId, entryNumber } = await postJournalEntry(client, {
    description: `Zakat payment #${input.paymentId} collection`,
    referenceType: "ZAKAT_PAYMENT",
    referenceId: input.paymentId,
    postedBy: input.postedBy,
    lines: [
      {
        accountId: cashAccount.id,
        walletId: wallet.id,
        debit: amount,
        lineDescription: `Dr ${wallet.name}`,
      },
      {
        accountId: incomeAccount.id,
        credit: amount,
        lineDescription: "Cr Zakat Income",
      },
    ],
  });

  await client.$executeRawUnsafe("UPDATE transactions SET journal_entry_id = ? WHERE id = ?", journalEntryId, input.transactionId);

  return { journalEntryId, entryNumber, skipped: false as const };
}

/** Distribution: Dr Distribution Expense, Cr Wallet Cash */
export async function postDistributionJournal(
  client: DbClient,
  input: {
    distributionId: number;
    amount: number;
    transactionId: number;
    postedBy: number;
    distributionType: string;
    walletType?: WalletType;
  },
) {
  const existing = await getJournalEntryByReference(client, "DISTRIBUTION", input.distributionId);
  if (existing) return { journalEntryId: existing.id, entryNumber: existing.entry_number, skipped: true as const };

  const walletType: WalletType =
    input.walletType ?? (input.distributionType === "EMERGENCY" ? "EMERGENCY" : "ZAKAT");

  const wallet = await getWalletByType(walletType, client);
  if (!wallet || wallet.status !== "ACTIVE") {
    throw Object.assign(new Error(`${walletType} wallet is not available`), { status: 400 });
  }

  const balance = await getWalletBalance(wallet.id, client);
  const amount = roundMoney(input.amount);
  if (balance < amount) {
    throw Object.assign(new Error(`Insufficient ${wallet.name} balance`), { status: 400 });
  }

  const expenseCode =
    walletType === "EMERGENCY" ? GL.EMERGENCY_DIST_EXPENSE : walletType === "OPERATIONS" ? GL.OPERATIONS_EXPENSE : GL.ZAKAT_DIST_EXPENSE;
  const cashCode =
    walletType === "EMERGENCY"
      ? GL.EMERGENCY_CASH
      : walletType === "OPERATIONS"
        ? GL.OPERATIONS_CASH
        : walletType === "SADAQAH"
          ? GL.SADAQAH_CASH
          : walletType === "MAIN"
            ? GL.MAIN_CASH
            : GL.ZAKAT_CASH;

  const expenseAccount = await getAccountByCode(client, expenseCode);
  const cashAccount = await getAccountByCode(client, cashCode);
  if (!expenseAccount || !cashAccount) {
    throw Object.assign(new Error("Required GL accounts are not configured"), { status: 500 });
  }

  const { journalEntryId, entryNumber } = await postJournalEntry(client, {
    description: `Distribution #${input.distributionId} (${input.distributionType})`,
    referenceType: "DISTRIBUTION",
    referenceId: input.distributionId,
    postedBy: input.postedBy,
    lines: [
      {
        accountId: expenseAccount.id,
        debit: amount,
        lineDescription: `Dr ${expenseAccount.name}`,
      },
      {
        accountId: cashAccount.id,
        walletId: wallet.id,
        credit: amount,
        lineDescription: `Cr ${wallet.name}`,
      },
    ],
  });

  await client.$executeRawUnsafe("UPDATE transactions SET journal_entry_id = ? WHERE id = ?", journalEntryId, input.transactionId);

  return { journalEntryId, entryNumber, skipped: false as const, walletId: wallet.id };
}

export async function reverseDistributionJournal(
  client: DbClient,
  input: { distributionId: number; reversedBy: number; transactionId?: number | null },
) {
  const entry = await getJournalEntryByReference(client, "DISTRIBUTION", input.distributionId);
  if (!entry) return null;
  const reversal = await reverseJournalEntry(client, {
    journalEntryId: entry.id,
    reversedBy: input.reversedBy,
    reason: `Reversal of distribution #${input.distributionId}`,
  });
  if (input.transactionId) {
    await client.$executeRawUnsafe("UPDATE transactions SET journal_entry_id = NULL WHERE id = ?", input.transactionId);
  }
  return reversal;
}

/** Community/mass distribution: Dr Distribution Expense, Cr Wallet Cash */
export async function postCommunityDistributionJournal(
  client: DbClient,
  input: {
    communityDistributionId: number;
    amount: number;
    transactionId: number;
    postedBy: number;
    distributionType: string;
    title: string;
    walletType?: WalletType;
  },
) {
  const existing = await getJournalEntryByReference(client, "COMMUNITY_DISTRIBUTION", input.communityDistributionId);
  if (existing) return { journalEntryId: existing.id, entryNumber: existing.entry_number, skipped: true as const };

  const walletType: WalletType =
    input.walletType ?? (input.distributionType === "EMERGENCY" ? "EMERGENCY" : "ZAKAT");

  const wallet = await getWalletByType(walletType, client);
  if (!wallet || wallet.status !== "ACTIVE") {
    throw Object.assign(new Error(`${walletType} wallet is not available`), { status: 400 });
  }

  const balance = await getWalletBalance(wallet.id, client);
  const amount = roundMoney(input.amount);
  if (balance < amount) {
    throw Object.assign(new Error(`Insufficient ${wallet.name} balance`), { status: 400 });
  }

  const expenseCode =
    walletType === "EMERGENCY" ? GL.EMERGENCY_DIST_EXPENSE : walletType === "OPERATIONS" ? GL.OPERATIONS_EXPENSE : GL.ZAKAT_DIST_EXPENSE;
  const cashCode =
    walletType === "EMERGENCY"
      ? GL.EMERGENCY_CASH
      : walletType === "OPERATIONS"
        ? GL.OPERATIONS_CASH
        : walletType === "SADAQAH"
          ? GL.SADAQAH_CASH
          : walletType === "MAIN"
            ? GL.MAIN_CASH
            : GL.ZAKAT_CASH;

  const expenseAccount = await getAccountByCode(client, expenseCode);
  const cashAccount = await getAccountByCode(client, cashCode);
  if (!expenseAccount || !cashAccount) {
    throw Object.assign(new Error("Required GL accounts are not configured"), { status: 500 });
  }

  const { journalEntryId, entryNumber } = await postJournalEntry(client, {
    description: `Community distribution #${input.communityDistributionId}: ${input.title}`,
    referenceType: "COMMUNITY_DISTRIBUTION",
    referenceId: input.communityDistributionId,
    postedBy: input.postedBy,
    lines: [
      {
        accountId: expenseAccount.id,
        debit: amount,
        lineDescription: `Dr ${expenseAccount.name}`,
      },
      {
        accountId: cashAccount.id,
        walletId: wallet.id,
        credit: amount,
        lineDescription: `Cr ${wallet.name}`,
      },
    ],
  });

  await client.$executeRawUnsafe("UPDATE transactions SET journal_entry_id = ? WHERE id = ?", journalEntryId, input.transactionId);

  return { journalEntryId, entryNumber, skipped: false as const, walletId: wallet.id };
}

export async function reverseCommunityDistributionJournal(
  client: DbClient,
  input: { communityDistributionId: number; reversedBy: number; transactionId?: number | null },
) {
  const entry = await getJournalEntryByReference(client, "COMMUNITY_DISTRIBUTION", input.communityDistributionId);
  if (!entry) return null;
  const reversal = await reverseJournalEntry(client, {
    journalEntryId: entry.id,
    reversedBy: input.reversedBy,
    reason: `Reversal of community distribution #${input.communityDistributionId}`,
  });
  if (input.transactionId) {
    await client.$executeRawUnsafe("UPDATE transactions SET journal_entry_id = NULL WHERE id = ?", input.transactionId);
  }
  return reversal;
}
