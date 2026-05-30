"use client";

import * as React from "react";
import { useGetTransactionsQuery } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { buildReceiptHtml } from "@/lib/receipt-print";
import { buildTransactionHtml } from "@/lib/transaction-print";

const methodValues = ["", "EVCPLUS", "E_DAHAB", "ZAAD", "CASH", "WALLET"] as const;
const statusValues = ["", "PENDING", "SUCCESS", "FAILED"] as const;

export default function DonorTransactionsPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [method, setMethod] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");

  const { data, isFetching } = useGetTransactionsQuery({
    page,
    pageSize,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    method: method || undefined,
    status: status || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyReset() {
    setPage(1);
  }

  function openCenteredPopup(width: number, height: number) {
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const w = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const h = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
    const left = Math.max(0, Math.round(dualScreenLeft + (w - width) / 2));
    const top = Math.max(0, Math.round(dualScreenTop + (h - height) / 2));
    return window.open(
      "",
      "_blank",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );
  }

  async function printReceiptByTransactionId(transactionId: number) {
    const res = await fetch(`/api/receipts/by-transaction/${transactionId}`, { method: "GET", credentials: "include" });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      data?: {
        receiptNumber: string;
        generatedAt: string;
        transactionId: number;
        transaction: { amount: number; type: "ZAKAT_PAYMENT" | "DISTRIBUTION"; method: string | null; beneficiaryCategory: "ORPHAN" | "POOR" | "EMERGENCY" | null };
        user?: { name: string | null; email: string | null };
      };
    };
    if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load receipt");

    const r = json.data;
    const w = openCenteredPopup(900, 980);
    if (!w) return;
    const html = buildReceiptHtml({
      receiptNumber: r.receiptNumber,
      generatedAt: r.generatedAt,
      transactionId: r.transactionId,
      transaction: {
        amount: r.transaction.amount,
        type: r.transaction.type,
        method: r.transaction.method,
        beneficiaryCategory: r.transaction.beneficiaryCategory,
      },
      user: r.user,
    });
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function printTransaction(transactionId: number) {
    const res = await fetch(`/api/transactions/${transactionId}`, { method: "GET", credentials: "include" });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      data?: {
        id: number;
        date: string;
        amount: number;
        type: "ZAKAT_PAYMENT" | "DISTRIBUTION" | "DEPOSIT";
        status: string;
        reference: string | null;
        method: string | null;
        beneficiaryCategory: "ORPHAN" | "POOR" | "EMERGENCY" | null;
        user?: { name: string | null; email: string | null };
      };
    };
    if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load transaction");

    const t = json.data;
    const w = openCenteredPopup(980, 980);
    if (!w) return;
    const html = buildTransactionHtml({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      status: t.status,
      reference: t.reference,
      method: t.method,
      beneficiaryCategory: t.beneficiaryCategory,
      user: t.user,
    });
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-black">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black/95">From</div>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onBlur={applyReset} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black/95">To</div>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onBlur={applyReset} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black/95">Method</div>
              <select
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  applyReset();
                }}
              >
                {methodValues.map((m) => (
                  <option key={m || "all"} value={m}>
                    {m === "E_DAHAB" ? "E-DAHAB" : m ? m : "All"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black/95">Status</div>
              <select
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  applyReset();
                }}
              >
                {statusValues.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s ? s : "All"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black/95">Rows</div>
              <select
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  applyReset();
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            {isFetching && !data ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : data?.items?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-black">{new Date(t.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                      <TableCell className="text-black">
                        <Badge
                          variant={t.type === "ZAKAT_PAYMENT" ? "success" : t.type === "DISTRIBUTION" ? "warning" : "secondary"}
                        >
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-black">{t.method}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "SUCCESS" ? "success" : t.status === "FAILED" ? "danger" : "warning"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              if (t.type === "ZAKAT_PAYMENT" && t.status === "SUCCESS") {
                                await printReceiptByTransactionId(t.id);
                              } else {
                                await printTransaction(t.id);
                              }
                            } catch (e) {
                              const err = e as { message?: string };
                              alert(err?.message ?? "Failed to print");
                            }
                          }}
                        >
                          {t.type === "ZAKAT_PAYMENT" && t.status === "SUCCESS" ? "Print Receipt" : "Print"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-sm text-black/80">No results found.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-black/80">
              Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

