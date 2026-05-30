"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateAdminAccountMutation, useDeleteAdminAccountMutation, useGetAdminAccountsQuery, useUpdateAdminAccountMutation } from "@/store/api";
import { FadeModal } from "@/components/common/fade-modal";
import { formatCurrency } from "@/lib/currency";

export default function AdminAccountsPage() {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const { data, refetch } = useGetAdminAccountsQuery({ q, page, pageSize });
  const [createAccount, { isLoading }] = useCreateAdminAccountMutation();
  const [updateAccount] = useUpdateAdminAccountMutation();
  const [deleteAccount] = useDeleteAdminAccountMutation();
  const [fullName, setFullName] = React.useState("");
  const [name, setName] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <FadeModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Account"
        titleClassName="text-[#065F46] text-3xl"
        bodyClassName="space-y-4"
      >
        <div className="space-y-2">
          <div className="text-sm font-medium text-black">Account name</div>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter account name" className="bg-white text-black" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            className="bg-[#065F46] text-white hover:bg-[#054e3a]"
            onClick={async () => {
              if (!selectedId) return;
              if (!editName.trim()) return toast.error("Account name is required");
              try {
                await updateAccount({ id: selectedId, name: editName.trim() }).unwrap();
                toast.success("Account updated");
                setEditOpen(false);
                await refetch();
              } catch (e) {
                const err = e as { data?: { error?: string } };
                toast.error(err?.data?.error ?? "Update account failed");
              }
            }}
          >
            Save
          </Button>
        </div>
      </FadeModal>

      <FadeModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        titleClassName="text-[#065F46] text-3xl"
        bodyClassName="space-y-4"
      >
        <p className="text-sm text-black">Are you sure you want to delete this account?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={async () => {
              if (!selectedId) return;
              try {
                await deleteAccount({ id: selectedId }).unwrap();
                toast.success("Account deleted");
                setDeleteOpen(false);
                await refetch();
              } catch (e) {
                const err = e as { data?: { error?: string } };
                toast.error(err?.data?.error ?? "Delete account failed");
              }
            }}
          >
            Delete
          </Button>
        </div>
      </FadeModal>

      <Card>
        <CardHeader>
          <CardTitle className="text-4xl font-semibold text-[#065F46]">Accounts</CardTitle>
          <div className="text-sm text-black/60">Manage donor wallet accounts (bank name, balance, status)</div>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search accounts..."
            className="bg-white text-black md:col-span-2"
          />
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" className="bg-white text-black" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className="bg-white text-black" />
          <Input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Opening balance" type="number" className="bg-white text-black" />
          <Button
            className="bg-[#065F46] text-white hover:bg-[#054e3a]"
            disabled={isLoading}
            onClick={async () => {
              try {
                await createAccount({ fullName, name, balance: Number(balance || 0) }).unwrap();
                toast.success("Account created");
                setFullName("");
                setName("");
                setBalance("");
                await refetch();
              } catch (e) {
                const err = e as { data?: { error?: string } };
                toast.error(err?.data?.error ?? "Create account failed");
              }
            }}
          >
            Add Account
          </Button>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black"
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
              <TableHead className="text-[15px] text-[#065F46]">Account</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Full Name</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Balance</TableHead>
              <TableHead className="text-[15px] text-[#065F46]">Status</TableHead>
              <TableHead className="text-right text-[15px] text-[#065F46]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-[15px] text-black">{a.name}</TableCell>
                <TableCell className="text-[15px] text-black">{a.user?.name ?? "-"}</TableCell>
                <TableCell className="text-[15px] font-semibold text-black">{formatCurrency(a.balance)}</TableCell>
                <TableCell className="text-[15px] text-black">{a.status}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedId(a.id);
                        setEditName(a.name);
                        setEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        setSelectedId(a.id);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!(data?.items ?? []).length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-black/60">
                  No accounts found.
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
    </>
  );
}

