"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApproveZakatPaymentMutation, useGetAdminZakatPaymentsQuery, useRejectZakatPaymentMutation } from "@/store/api";
import { formatCurrency } from "@/lib/currency";

export default function AdminPayZakatPage() {
  const [status, setStatus] = React.useState<"PENDING" | "APPROVED" | "REJECTED" | "">("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const { data, refetch, isFetching } = useGetAdminZakatPaymentsQuery({
    status: status || undefined,
    page,
    pageSize,
  });
  const [approvePayment, { isLoading: approving }] = useApproveZakatPaymentMutation();
  const [rejectPayment, { isLoading: rejecting }] = useRejectZakatPaymentMutation();
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[#065F46]">Zakat Payments</CardTitle>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "PENDING" | "APPROVED" | "REJECTED" | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm text-black"
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Nisab</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-black">{p.user.name}</TableCell>
                <TableCell className="text-black">{p.account.name ?? "-"}</TableCell>
                <TableCell className="text-black font-semibold">{formatCurrency(p.amount)}</TableCell>
                <TableCell className="text-black">{p.method}</TableCell>
                <TableCell>
                  <Badge variant={p.nisabChecked ? "success" : "warning"}>{p.nisabChecked ? "Checked" : "Below Nisab"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === "APPROVED" ? "success" : p.status === "REJECTED" ? "danger" : "warning"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-black">{new Date(p.createdAt).toLocaleString()}</TableCell>
                <TableCell className="space-x-2">
                  {p.status === "PENDING" ? (
                    <>
                      <Button
                        size="sm"
                        className="bg-[#065F46] text-white hover:bg-[#054e3a]"
                        disabled={approving || rejecting || isFetching}
                        onClick={async () => {
                          try {
                            await approvePayment({ id: p.id }).unwrap();
                            toast.success("Payment approved");
                            await refetch();
                          } catch (e) {
                            const err = e as { data?: { error?: string } };
                            toast.error(err?.data?.error ?? "Approve failed");
                          }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={approving || rejecting || isFetching}
                        onClick={async () => {
                          try {
                            await rejectPayment({ id: p.id }).unwrap();
                            toast.success("Payment rejected");
                            await refetch();
                          } catch (e) {
                            const err = e as { data?: { error?: string } };
                            toast.error(err?.data?.error ?? "Reject failed");
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-black/60">No actions</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!(data?.items ?? []).length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-black/60">
                  No zakat payments found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-black/70">
            {total > 0 ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total}` : "Showing 0 to 0 of 0"}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm text-black"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-black">{page}</span>
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
  );
}

