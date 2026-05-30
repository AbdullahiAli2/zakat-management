"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetAdminReceiptsQuery } from "@/store/api";
import { formatCurrency } from "@/lib/currency";
import { buildReceiptHtml } from "@/lib/receipt-print";

export default function AdminReceiptsPage() {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const { data } = useGetAdminReceiptsQuery({ q, page, pageSize });
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  const printReceipt = React.useCallback(
    async (receiptId: number) => {
      const res = await fetch(`/api/admin/receipts/${receiptId}`, { method: "GET", credentials: "include" });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          receiptNumber: string;
          transactionId: number;
          generatedAt: string;
          transaction: {
            amount: number;
            status: string;
            type: "ZAKAT_PAYMENT" | "DISTRIBUTION";
            createdAt: string;
            method?: string | null;
            beneficiaryCategory?: "ORPHAN" | "POOR" | "EMERGENCY" | null;
          };
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
          method: r.transaction.method ?? null,
          beneficiaryCategory: r.transaction.beneficiaryCategory ?? null,
        },
        user: r.user,
      });
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    },
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl font-semibold text-[#065F46]">Receipts</CardTitle>
        <div className="text-sm text-black/60">Track generated receipts linked to successful transactions</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search receipt number..."
            className="max-w-sm bg-white text-black"
          />
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[15px] text-[#065F46]">Receipt #</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Full Name</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">From / Category</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Amount</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Generated</TableHead>
              <TableHead className="text-right text-[15px] text-[#065F46]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-[15px] text-black">{r.receiptNumber}</TableCell>
                <TableCell className="text-[15px] text-black">{r.user?.name ?? "-"}</TableCell>
                <TableCell className="text-[15px] text-black">
                  {r.transactionType === "ZAKAT_PAYMENT" ? (
                    <span>{`Donor (${r.paymentMethod ?? "-"})`}</span>
                  ) : (
                    <span>{`Distribution (${r.beneficiaryCategory ?? "-"})`}</span>
                  )}
                </TableCell>
                <TableCell className="text-[15px] font-semibold text-black">{formatCurrency(r.amount)}</TableCell>
                <TableCell className="text-[15px] text-black">{new Date(r.generatedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await printReceipt(r.id);
                      } catch (e) {
                        const err = e as { message?: string };
                        alert(err?.message ?? "Failed to print receipt");
                      }
                    }}
                  >
                    Print
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!(data?.items ?? []).length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-black/60">
                  No receipts found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-black/70">
            {total > 0 ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total}` : "Showing 0 to 0 of 0"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-black">{page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

