"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  useGenerateAdminReportMutation,
  useGetAdminDistributionSummaryQuery,
  useGetAdminOverviewQuery,
} from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStatCard } from "@/components/dashboard/dashboard-widgets";
import { formatCurrency } from "@/lib/currency";
import { REPORT_TYPE_LABELS, REPORT_TYPES, type ReportType } from "@/lib/reports";
import { FileBarChart, Printer } from "lucide-react";

type ReportRow = Record<string, unknown>;

type ColumnDef = {
  key: string;
  label: string;
  format?: (value: unknown, row: ReportRow) => React.ReactNode;
};

const REPORT_COLUMNS: Record<ReportType, ColumnDef[]> = {
  DONOR_LIST: [
    { key: "fullName", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    {
      key: "registeredAt",
      label: "Registered",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
  ],
  ZAKAT_PAYMENTS: [
    { key: "fullName", label: "Full Name" },
    { key: "account", label: "Account" },
    { key: "amount", label: "Amount", format: (v) => formatCurrency(Number(v ?? 0)) },
    { key: "zakatType", label: "Zakat Type" },
    { key: "method", label: "Method" },
    {
      key: "status",
      label: "Status",
      format: (v) => (
        <Badge variant={v === "APPROVED" ? "success" : v === "PENDING" ? "warning" : "secondary"}>{String(v)}</Badge>
      ),
    },
    { key: "nisab", label: "Nisab" },
    {
      key: "submittedAt",
      label: "Submitted",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
    {
      key: "approvedAt",
      label: "Approved",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
  ],
  TRANSACTION_LEDGER: [
    {
      key: "date",
      label: "Date",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
    { key: "user", label: "User" },
    { key: "amount", label: "Amount", format: (v) => formatCurrency(Number(v ?? 0)) },
    { key: "type", label: "Type" },
    { key: "method", label: "Method" },
    {
      key: "status",
      label: "Status",
      format: (v) => (
        <Badge variant={v === "SUCCESS" ? "success" : v === "PENDING" ? "warning" : "secondary"}>{String(v)}</Badge>
      ),
    },
    { key: "reference", label: "Reference" },
  ],
  DISTRIBUTION_SUMMARY: [
    { key: "beneficiary", label: "Beneficiary" },
    { key: "amount", label: "Amount", format: (v) => formatCurrency(Number(v ?? 0)) },
    { key: "type", label: "Type" },
    {
      key: "status",
      label: "Status",
      format: (v) => <Badge variant="secondary">{String(v)}</Badge>,
    },
    {
      key: "createdAt",
      label: "Created",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
    {
      key: "completedAt",
      label: "Completed",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
  ],
  BENEFICIARY_LIST: [
    { key: "fullName", label: "Full Name" },
    { key: "phone", label: "Phone" },
    { key: "category", label: "Category" },
    { key: "nationalId", label: "National ID" },
    {
      key: "status",
      label: "Status",
      format: (v) => <Badge variant="secondary">{String(v).replace(/_/g, " ")}</Badge>,
    },
    {
      key: "registeredAt",
      label: "Registered",
      format: (v) => (v ? new Date(String(v)).toLocaleString() : "—"),
    },
  ],
};

function reportLabel(type: string) {
  return REPORT_TYPE_LABELS[type as ReportType] ?? type;
}

function printReport(title: string, columns: ColumnDef[], rows: ReportRow[], generatedAt: string) {
  const header = columns.map((c) => `<th>${c.label}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = row[col.key];
          let text = raw === null || raw === undefined ? "—" : String(raw);
          if (col.key === "amount" || col.key.toLowerCase().includes("amount")) {
            const n = Number(raw);
            if (!Number.isNaN(n)) text = formatCurrency(n);
          }
          if (String(col.key).toLowerCase().includes("at") || col.key === "date") {
            const d = new Date(String(raw));
            if (!Number.isNaN(d.getTime())) text = d.toLocaleString();
          }
          return `<td>${text}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:20px;margin:0 0 4px}p{color:#555;font-size:13px}
    table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f7f8f9}</style>
    </head><body>
    <h1>${title}</h1>
    <p>Generated ${new Date(generatedAt).toLocaleString()} · ${rows.length} record(s)</p>
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  w.document.close();
  w.print();
}

export default function AdminReportsPage() {
  const { data: overview, isFetching: overviewLoading } = useGetAdminOverviewQuery();
  const { data: distSummary, isFetching: distLoading } = useGetAdminDistributionSummaryQuery();
  const [generateReport, { isLoading: generating }] = useGenerateAdminReportMutation();

  const [selectedType, setSelectedType] = React.useState<ReportType>("ZAKAT_PAYMENTS");
  const [rows, setRows] = React.useState<ReportRow[]>([]);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [reportId, setReportId] = React.useState<number | null>(null);

  const columns = REPORT_COLUMNS[selectedType];

  async function onGenerate() {
    try {
      const result = await generateReport({ reportType: selectedType }).unwrap();
      const payload = Array.isArray(result.payload) ? (result.payload as ReportRow[]) : [];
      setRows(payload);
      setGeneratedAt(result.generatedAt);
      setReportId(result.id);
      toast.success(`${reportLabel(selectedType)} report ready`);
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Failed to generate report");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          title="Zakat Collected"
          value={formatCurrency(overview?.totalZakatCollected ?? "0")}
          loading={overviewLoading}
        />
        <DashboardStatCard
          title="Total Distributed"
          value={formatCurrency(overview?.totalDistributed ?? "0")}
          loading={overviewLoading}
        />
        <DashboardStatCard
          title="Pool Balance"
          value={formatCurrency(overview?.remainingBalance ?? "0")}
          loading={overviewLoading}
          hint="Available for distributions"
        />
        <DashboardStatCard
          title="Distribution Total"
          value={formatCurrency(distSummary?.total ?? 0)}
          loading={distLoading}
          hint="Approved & completed aid"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-4xl font-semibold text-[#065F46]">
              <FileBarChart className="h-9 w-9 shrink-0" />
              Reports
            </CardTitle>
            <div className="mt-1 text-sm text-black/60">
              Generate printable lists for donors, zakat payments, transactions, and more.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as ReportType);
                setRows([]);
                setGeneratedAt(null);
              }}
              className="h-10 min-w-[200px] rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <Button
              className="bg-[#065F46] text-white hover:bg-[#054e3a]"
              disabled={generating}
              onClick={onGenerate}
            >
              {generating ? "Loading…" : "Generate"}
            </Button>
            <Button
              variant="outline"
              disabled={!rows.length || !generatedAt}
              onClick={() => printReport(reportLabel(selectedType), columns, rows, generatedAt!)}
            >
              <Printer className="mr-1 h-4 w-4" />
              Print
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {generating ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length ? (
            <>
              <div className="mb-3 text-sm text-black/60">
                {reportLabel(selectedType)}
                {reportId ? ` · Report #${reportId}` : ""}
                {generatedAt ? ` · ${new Date(generatedAt).toLocaleString()}` : ""}
                {" · "}
                {rows.length} record{rows.length === 1 ? "" : "s"}
              </div>
              <div className="overflow-x-auto rounded-lg border border-black/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col.key} className="whitespace-nowrap text-black">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={String(row.id ?? idx)}>
                        {columns.map((col) => {
                          const raw = row[col.key];
                          return (
                            <TableCell key={col.key} className="text-black">
                              {col.format ? col.format(raw, row) : raw === null || raw === undefined ? "—" : String(raw)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-black/15 bg-black/[0.02] px-4 py-12 text-center text-sm text-black/55">
              Choose a report type and click <span className="font-semibold text-black">Generate</span> to load data.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
