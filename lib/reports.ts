import { prisma } from "./db";

export const REPORT_TYPES = [
  "DONOR_LIST",
  "ZAKAT_PAYMENTS",
  "TRANSACTION_LEDGER",
  "DISTRIBUTION_SUMMARY",
  "BENEFICIARY_LIST",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  DONOR_LIST: "Donor List",
  ZAKAT_PAYMENTS: "Pay Zakat",
  TRANSACTION_LEDGER: "Transactions",
  DISTRIBUTION_SUMMARY: "Distributions",
  BENEFICIARY_LIST: "Beneficiaries",
};

export async function buildReportPayload(reportType: string): Promise<Record<string, unknown>[]> {
  switch (reportType) {
    case "DONOR_LIST":
      return (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number;
            fullName: string | null;
            email: string;
            isActive: number | boolean;
            createdAt: Date;
          }>
        >(
          `SELECT u.id,
                  TRIM(CONCAT(IFNULL(u.first_name,''), ' ', IFNULL(u.last_name,''))) AS fullName,
                  u.email,
                  u.is_active AS isActive,
                  u.created_at AS createdAt
           FROM users u
           WHERE u.role = 'DONOR'
           ORDER BY u.created_at DESC
           LIMIT 500`,
        )
      ).map((r) => ({
        id: r.id,
        fullName: r.fullName?.trim() || "—",
        email: r.email,
        status: r.isActive === true || r.isActive === 1 ? "Active" : "Inactive",
        registeredAt: r.createdAt,
      }));

    case "ZAKAT_PAYMENTS":
    case "ZAKAT_SUMMARY":
      return (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number;
            fullName: string | null;
            accountName: string | null;
            amount: number | string;
            zakatType: string;
            method: string;
            status: string;
            nisabChecked: number | boolean;
            createdAt: Date;
            approvedAt: Date | null;
          }>
        >(
          `SELECT zp.id,
                  CONCAT(u.first_name, ' ', u.last_name) AS fullName,
                  a.name AS accountName,
                  zp.amount,
                  zp.zakat_type AS zakatType,
                  zp.method,
                  zp.status,
                  zp.nisab_checked AS nisabChecked,
                  zp.created_at AS createdAt,
                  zp.approved_at AS approvedAt
           FROM zakat_payments zp
           INNER JOIN users u ON u.id = zp.user_id
           LEFT JOIN accounts a ON a.id = zp.account_id
           ORDER BY zp.created_at DESC
           LIMIT 500`,
        )
      ).map((r) => ({
        id: r.id,
        fullName: r.fullName?.trim() || "—",
        account: r.accountName ?? "—",
        amount: Number(r.amount),
        zakatType: r.zakatType,
        method: r.method,
        status: r.status,
        nisab: r.nisabChecked === true || r.nisabChecked === 1 ? "Checked" : "Below Nisab",
        submittedAt: r.createdAt,
        approvedAt: r.approvedAt,
      }));

    case "TRANSACTION_LEDGER":
      return (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number;
            createdAt: Date;
            amount: number | string;
            type: string;
            status: string;
            reference: string | null;
            method: string | null;
            userName: string | null;
          }>
        >(
          `SELECT t.id, t.created_at AS createdAt, t.amount, t.type, t.status, t.reference, zp.method,
                  TRIM(CONCAT(IFNULL(u.first_name,''), ' ', IFNULL(u.last_name,''))) AS userName
           FROM transactions t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
           ORDER BY t.created_at DESC
           LIMIT 500`,
        )
      ).map((r) => ({
        id: r.id,
        date: r.createdAt,
        user: r.userName?.trim() || "—",
        amount: Number(r.amount),
        type: r.type,
        method: r.method ?? "—",
        status: r.status,
        reference: r.reference ?? "—",
      }));

    case "DISTRIBUTION_SUMMARY":
      return (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number;
            beneficiaryName: string | null;
            amount: number | string;
            distributionType: string;
            status: string;
            createdAt: Date;
            completedAt: Date | null;
          }>
        >(
          `SELECT d.id,
                  TRIM(CONCAT(IFNULL(b.first_name,''), ' ', IFNULL(b.last_name,''))) AS beneficiaryName,
                  d.amount,
                  d.distribution_type AS distributionType,
                  d.status,
                  d.created_at AS createdAt,
                  d.completed_at AS completedAt
           FROM distributions d
           INNER JOIN beneficiaries b ON b.id = d.beneficiary_id
           ORDER BY d.created_at DESC
           LIMIT 500`,
        )
      ).map((r) => ({
        id: r.id,
        beneficiary: r.beneficiaryName?.trim() || "—",
        amount: Number(r.amount),
        type: r.distributionType,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));

    case "BENEFICIARY_LIST":
      return (
        await prisma.$queryRawUnsafe<
          Array<{
            id: number;
            fullName: string | null;
            phone: string | null;
            category: string;
            nationalId: string | null;
            status: string;
            createdAt: Date;
          }>
        >(
          `SELECT b.id,
                  TRIM(CONCAT(IFNULL(b.first_name,''), ' ', IFNULL(b.last_name,''))) AS fullName,
                  b.phone,
                  b.category,
                  b.national_id AS nationalId,
                  b.status,
                  b.created_at AS createdAt
           FROM beneficiaries b
           ORDER BY b.created_at DESC
           LIMIT 500`,
        )
      ).map((r) => ({
        id: r.id,
        fullName: r.fullName?.trim() || "—",
        phone: r.phone ?? "—",
        category: r.category,
        nationalId: r.nationalId ?? "—",
        status: r.status,
        registeredAt: r.createdAt,
      }));

    default:
      return [];
  }
}
