"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateMyAccountMutation, useDeleteMyAccountMutation, useGetAccountsMeQuery, useUpdateMyAccountMutation } from "@/store/api";
import { FadeModal } from "@/components/common/fade-modal";
import { FormField } from "@/components/common/form-field";
import { formatCurrency } from "@/lib/currency";

export default function DonorAccountsPage() {
  const { data, refetch } = useGetAccountsMeQuery();
  const [createAccount, { isLoading: creating }] = useCreateMyAccountMutation();
  const [updateAccount, { isLoading: updating }] = useUpdateMyAccountMutation();
  const [deleteAccount, { isLoading: deleting }] = useDeleteMyAccountMutation();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const [name, setName] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [editName, setEditName] = React.useState("");
  const [editBalance, setEditBalance] = React.useState("");

  function resetCreateForm() {
    setName("");
    setBalance("");
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function openEditModal(account: { id: number; name: string; balance: string | number }) {
    setSelectedId(account.id);
    setEditName(account.name);
    setEditBalance(String(account.balance ?? ""));
    setEditOpen(true);
  }

  async function submitCreate() {
    if (!name.trim()) {
      toast.error("Account name is required");
      return;
    }
    try {
      await createAccount({ name: name.trim(), balance: Number(balance || 0) }).unwrap();
      toast.success("Account created");
      setCreateOpen(false);
      resetCreateForm();
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Failed to create account");
    }
  }

  async function submitEdit() {
    if (!selectedId) return;
    if (!editName.trim()) {
      toast.error("Account name is required");
      return;
    }
    try {
      await updateAccount({ id: selectedId, name: editName.trim(), balance: Number(editBalance || 0) }).unwrap();
      toast.success("Account updated");
      setEditOpen(false);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Update failed");
    }
  }

  async function submitDelete() {
    if (!selectedId) return;
    try {
      await deleteAccount({ id: selectedId }).unwrap();
      toast.success("Account deleted");
      setDeleteOpen(false);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Delete failed");
    }
  }

  return (
    <>
      <FadeModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title="Add Account"
        saveLabel="Save"
        onSave={submitCreate}
        saveLoading={creating}
        saveDisabled={!name.trim()}
      >
        <div className="space-y-4">
          <FormField label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter account name (e.g. Main Wallet)"
              className="border-[#b5cec4] bg-white text-black placeholder:text-black/45"
            />
          </FormField>
          <FormField label="Opening Balance" hint="Optional — defaults to $0.00">
            <Input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              className="border-[#b5cec4] bg-white text-black placeholder:text-black/45"
            />
          </FormField>
        </div>
      </FadeModal>

      <FadeModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Account"
        saveLabel="Save"
        onSave={submitEdit}
        saveLoading={updating}
        saveDisabled={!editName.trim()}
      >
        <div className="space-y-4">
          <FormField label="Name">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter account name"
              className="border-[#b5cec4] bg-white text-black placeholder:text-black/45"
            />
          </FormField>
          <FormField label="Balance" hint="For demo/testing. In real banking this would be synced from payments.">
            <Input
              value={editBalance}
              onChange={(e) => setEditBalance(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              className="border-[#b5cec4] bg-white text-black placeholder:text-black/45"
            />
          </FormField>
        </div>
      </FadeModal>

      <FadeModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        saveLabel="Delete"
        saveVariant="destructive"
        onSave={submitDelete}
        saveLoading={deleting}
      >
        <p className="text-sm text-black/80">Are you sure you want to delete this account? This action cannot be undone.</p>
      </FadeModal>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">My Accounts</CardTitle>
            <div className="text-sm text-black/60">Create, edit, and delete your donor wallet accounts</div>
          </div>
          <Button className="shrink-0" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[15px] text-[#065F46]">Account</TableHead>
                <TableHead className="text-[15px] text-[#065F46]">Created</TableHead>
                <TableHead className="text-[15px] text-[#065F46]">Balance</TableHead>
                <TableHead className="text-[15px] text-[#065F46]">Status</TableHead>
                <TableHead className="text-right text-[15px] text-[#065F46]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.accounts ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-[15px] font-medium text-black">{a.name}</TableCell>
                  <TableCell className="text-[15px] text-black">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-[15px] font-semibold text-black">{formatCurrency(a.balance)}</TableCell>
                  <TableCell className="text-[15px] text-black">{a.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(a)}>
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
              {!(data?.accounts ?? []).length ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-black/60">
                    No accounts found. Click &quot;Add Account&quot; to create your first wallet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
