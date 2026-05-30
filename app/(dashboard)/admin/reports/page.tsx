"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  useGenerateAdminReportMutation,
  useGetAdminDistributionSummaryQuery,
  useGetAdminOverviewQuery,
  useGetAdminReportsQuery,
} from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeModal } from "@/components/common/fade-modal";
import { DashboardStatCard } from "@/components/dashboard/dashboard-widgets";
import { formatCurrency } from "@/lib/currency";
import { Download, Eye, FileBarChart, Printer, RefreshCw } from "lucide-react";

type ReportType = "ZAKAT_SUMMARY" | "TRANSACTION_LEDGER";

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: "ZAKAT_SUMMARY", label: "Zakat Payment Summary", description: "Totals grouped by payment status" },
  { value: "TRANSACTION_LEDGER", label: "Transaction Ledger", description: "Up to 500 most recent transactions" },
];

const REPORT_TYPE_LABELS: Record<string, string> = {
  ZAKAT_SUMMARY: "Zakat Payment Summary",
  TRANSACTION_LEDGER: "Transaction Ledger",
  DISTRIBUTION_SUMMARY: "Distribution Summary",
  BENEFICIARY_LIST: "Beneficiary List",
  AUDIT_TRAIL: "Audit Trail",
};

function reportTypeLabel(type: string | null | undefined) {
  if (!type) return "—";
  return REPORT_TYPE_LABELS[type] ?? type;
}

function formatCellValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toLocaleString();
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("amount") || key === "total" || key === "monthlyIncome") {
    const n = Number(value);
    if (!Number.isNaN(n)) return formatCurrency(n);
  }
  if (key.toLowerCase().includes("at") || key === "createdAt" || key === "verifiedAt") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(value);
}

function PayloadTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <div className="py-8 text-center text-sm text-black/60">No records in this report.</div>;
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );

  const displayColumns = columns.slice(0, 8);

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10">
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap capitalize">
                {col.replace(/([A-Z])/g, " $1").trim()}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={String(row.id ?? idx)}>
              {displayColumns.map((col) => (
                <TableCell key={col} className="max-w-[220px] truncate text-black">
                  {formatCellValue(col, row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {columns.length > displayColumns.length ? (
        <div className="border-t border-black/10 px-3 py-2 text-xs text-black/50">
          Showing {displayColumns.length} of {columns.length} columns. Download JSON for full data.
        </div>
      ) : null}
    </div>
  );
}

type GeneratedReport = {
  id: number;
  reportType: string;
  generatedAt: string;
  payload: unknown;
};

export default function AdminReportsPage() {
  const { data: overview, isFetching: overviewLoading } = useGetAdminOverviewQuery();
  const { data: distSummary, isFetching: distLoading } = useGetAdminDistributionSummaryQuery();
  const { data: history, isFetching: historyLoading, refetch: refetchHistory } = useGetAdminReportsQuery();
  const [generateReport, { isLoading: generating }] = useGenerateAdminReportMutation();

  const [selectedType, setSelectedType] = React.useState<ReportType>("ZAKAT_SUMMARY");
  const [viewReport, setViewReport] = React.useState<GeneratedReport | null>(null);

  async function onGenerate(type: ReportType = selectedType) {
    try {
      const result = await generateReport({ reportType: type }).unwrap();
      setViewReport(result);
      toast.success(`${reportTypeLabel(type)} generated`);
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Failed to generate report");
    }
  }

  function downloadJson(report: GeneratedReport) {
    const blob = new Blob([JSON.stringify(report.payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportType.toLowerCase()}-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport(report: GeneratedReport) {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = Array.isArray(report.payload) ? (report.payload as Record<string, unknown>[]) : [];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const header = cols.map((c) => `<th>${c}</th>`).join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${cols.map((c) => `<td>${formatCellValue(c, row[c])}</td>`).join("")}</tr>`,
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${reportTypeLabel(report.reportType)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}th{background:#f7f8f9}</style>
      </head><body>
      <h1>${reportTypeLabel(report.reportType)}</h1>
      <p>Generated ${new Date(report.generatedAt).toLocaleString()}</p>
      <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
      </body></html>`);
    w.document.close();
    w.print();
  }

  const payloadRows = Array.isArray(viewReport?.payload) ? (viewReport.payload as Record<string, unknown>[]) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-semibold text-[#065F46]">
            <FileBarChart className="h-8 w-8" />
            Reports
          </CardTitle>
          <div className="text-sm text-black/60">
            Financial overview and exportable summaries for zakat payments and transactions.
          </div>
        </CardHeader>
      </Card>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[#065F46]">Generate report</CardTitle>
            <div className="text-sm text-black/60">Select a report type and generate a snapshot from live data.</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {REPORT_TYPES.map((rt) => (
                <label
                  key={rt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    selectedType === rt.value
                      ? "border-[#065F46]/40 bg-[#ecfdf5]"
                      : "border-black/10 bg-white hover:border-[#065F46]/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={rt.value}
                    checked={selectedType === rt.value}
                    onChange={() => setSelectedType(rt.value)}
                    className="mt-1 accent-[#065F46]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-black">{rt.label}</span>
                    <span className="mt-0.5 block text-xs text-black/55">{rt.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button
              className="w-full bg-[#065F46] text-white hover:bg-[#054e3a]"
              disabled={generating}
              onClick={() => onGenerate()}
            >
              {generating ? "Generating…" : "Generate report"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-semibold text-[#065F46]">Recent reports</CardTitle>
              <div className="text-sm text-black/60">Last 50 generated reports. Regenerate to view data again.</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={historyLoading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {historyLoading && !history ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : history?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="secondary">{reportTypeLabel(r.reportType)}</Badge>
                      </TableCell>
                      <TableCell className="text-black">{new Date(r.generatedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-black">{r.generatedBy ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#065F46]"
                          disabled={
                            generating ||
                            !r.reportType ||
                            (r.reportType !== "ZAKAT_SUMMARY" && r.reportType !== "TRANSACTION_LEDGER")
                          }
                          onClick={() => {
                            if (r.reportType === "ZAKAT_SUMMARY" || r.reportType === "TRANSACTION_LEDGER") {
                              onGenerate(r.reportType);
                            }
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Regenerate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-black/60">No reports generated yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <FadeModal
        open={Boolean(viewReport)}
        onOpenChange={(o) => !o && setViewReport(null)}
        title={viewReport ? reportTypeLabel(viewReport.reportType) : "Report"}
        className="sm:max-w-[960px]"
        hideFooter
      >
        {viewReport ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-black/60">
              <span>
                Report #{viewReport.id} · {new Date(viewReport.generatedAt).toLocaleString()} · {payloadRows.length}{" "}
                record{payloadRows.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => printReport(viewReport)}>
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadJson(viewReport)}>
                  <Download className="mr-1 h-4 w-4" />
                  Download JSON
                </Button>
              </div>
            </div>
            <PayloadTable rows={payloadRows} />
          </div>
        ) : null}
      </FadeModal>
    </div>
  );
}
