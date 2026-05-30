"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FadeModal } from "@/components/common/fade-modal";
import { FormField, FormSelect } from "@/components/common/form-field";
import {
  useCreateAdminDistributionMutation,
  useDeleteAdminDistributionMutation,
  useGetAdminBeneficiariesQuery,
  useGetAdminDistributionsQuery,
  useUpdateAdminDistributionMutation,
} from "@/store/api";

const DISTRIBUTION_TYPES = ["FOOD", "CASH", "MEDICAL", "EDUCATION", "WATER", "EMERGENCY"] as const;
const STATUSES = ["PENDING", "APPROVED", "COMPLETED"] as const;

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "APPROVED") return "secondary" as const;
  return "warning" as const;
}

export default function AdminDistributionsPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const [beneficiaryId, setBeneficiaryId] = React.useState<number | "">("");
  const [distributionType, setDistributionType] = React.useState<(typeof DISTRIBUTION_TYPES)[number]>("CASH");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState<(typeof STATUSES)[number]>("COMPLETED");

  const { data, refetch } = useGetAdminDistributionsQuery({ page, pageSize });
  const { data: beneficiaries } = useGetAdminBeneficiariesQuery({ page: 1, pageSize: 100 });
  const [createDistribution, { isLoading: creating }] = useCreateAdminDistributionMutation();
  const [updateDistribution] = useUpdateAdminDistributionMutation();
  const [deleteDistribution, { isLoading: deleting }] = useDeleteAdminDistributionMutation();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetForm() {
    setBeneficiaryId("");
    setDistributionType("CASH");
    setAmount("");
    setNotes("");
    setStatus("COMPLETED");
  }

  async function submitCreate() {
    if (!beneficiaryId) {
      toast.error("Please select a beneficiary");
      return;
    }
    try {
      await createDistribution({
        beneficiaryId: Number(beneficiaryId),
        distributionType,
        amount: Number(amount),
        notes: notes.trim() || undefined,
        status,
      }).unwrap();
      toast.success("Distribution added");
      setCreateOpen(false);
      resetForm();
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Create distribution failed");
    }
  }

  async function submitDelete() {
    if (!selectedId) return;
    try {
      await deleteDistribution({ id: selectedId }).unwrap();
      toast.success("Distribution removed");
      setDeleteOpen(false);
      setSelectedId(null);
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
          if (!open) resetForm();
        }}
        title="Add Distribution"
        onSave={submitCreate}
        saveLoading={creating}
        saveDisabled={!beneficiaryId || !amount || Number(amount) <= 0}
      >
        <div className="space-y-4">
          <FormField label="Beneficiary">
            <FormSelect value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select beneficiary</option>
              {(beneficiaries?.items ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName} ({b.category})
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Distribution Type">
            <FormSelect value={distributionType} onChange={(e) => setDistributionType(e.target.value as (typeof DISTRIBUTION_TYPES)[number])}>
              {DISTRIBUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="border-[#b5cec4] bg-white text-black" />
          </FormField>
          <FormField label="Status">
            <FormSelect value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="border-[#b5cec4] bg-white text-black" />
          </FormField>
        </div>
      </FadeModal>

      <FadeModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setSelectedId(null);
        }}
        title="Delete Distribution"
        saveLabel="Delete"
        saveVariant="destructive"
        onSave={submitDelete}
        saveLoading={deleting}
      >
        <p className="text-sm text-black/80">
          Are you sure you want to delete this distribution? This action cannot be undone.
        </p>
      </FadeModal>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Distributions</CardTitle>
            <div className="text-sm text-black/60">Record zakat distributions to registered beneficiaries</div>
          </div>
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Distribution
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm text-black"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#065F46]">Beneficiary</TableHead>
                <TableHead className="text-[#065F46]">Category</TableHead>
                <TableHead className="text-[#065F46]">Type</TableHead>
                <TableHead className="text-[#065F46]">Amount</TableHead>
                <TableHead className="text-[#065F46]">Status</TableHead>
                <TableHead className="text-[#065F46]">Admin</TableHead>
                <TableHead className="text-[#065F46]">Date</TableHead>
                <TableHead className="text-[#065F46]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-black">{d.beneficiaryName}</TableCell>
                  <TableCell className="text-black">{d.beneficiaryCategory}</TableCell>
                  <TableCell className="text-black">{d.distributionType}</TableCell>
                  <TableCell className="text-black">{d.amount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-black">{d.adminName ?? "-"}</TableCell>
                  <TableCell className="text-black">{new Date(d.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {d.status !== "COMPLETED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await updateDistribution({ id: d.id, status: "COMPLETED" }).unwrap();
                              toast.success("Distribution completed");
                              await refetch();
                            } catch (e) {
                              const err = e as { data?: { error?: string } };
                              toast.error(err?.data?.error ?? "Complete failed");
                            }
                          }}
                        >
                          Complete
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          setSelectedId(d.id);
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
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-black/60">
                    No distributions yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <div className="text-sm text-black/70">
              {total > 0 ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total}` : "Showing 0 to 0 of 0"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-black">{page}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
