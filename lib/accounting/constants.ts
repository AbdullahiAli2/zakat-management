export const WALLET_TYPES = ["MAIN", "ZAKAT", "SADAQAH", "EMERGENCY", "OPERATIONS"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const WALLET_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const JOURNAL_REFERENCE_TYPES = ["ZAKAT_PAYMENT", "DISTRIBUTION", "COMMUNITY_DISTRIBUTION", "MANUAL", "OPENING_BALANCE"] as const;
export type JournalReferenceType = (typeof JOURNAL_REFERENCE_TYPES)[number];

/** Default GL account codes for automated postings */
export const GL = {
  MAIN_CASH: "1000",
  ZAKAT_CASH: "1010",
  SADAQAH_CASH: "1020",
  EMERGENCY_CASH: "1030",
  OPERATIONS_CASH: "1040",
  ZAKAT_INCOME: "4000",
  SADAQAH_INCOME: "4100",
  ZAKAT_DIST_EXPENSE: "5000",
  EMERGENCY_DIST_EXPENSE: "5100",
  OPERATIONS_EXPENSE: "5200",
} as const;

export const DEFAULT_WALLET_CODES = {
  MAIN: "WAL-MAIN",
  ZAKAT: "WAL-ZAKAT",
  SADAQAH: "WAL-SADAQAH",
  EMERGENCY: "WAL-EMERGENCY",
  OPERATIONS: "WAL-OPS",
} as const;
