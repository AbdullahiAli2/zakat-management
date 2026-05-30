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
  useApproveAdminCommunityDistributionMutation,
  useCompleteAdminCommunityDistributionMutation,
  useCreateAdminCommunityDistributionMutation,
  useDeleteAdminCommunityDistributionMutation,
  useGetAdminCommunityDistributionsQuery,
} from "@/store/api";

const DISTRIBUTION_TYPES = ["FOOD", "CASH", "MEDICAL", "EDUCATION", "WATER", "EMERGENCY"] as const;
const STATUSES = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as const;

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "APPROVED") return "secondary" as const;
  if (status === "REJECTED") return "danger" as const;
  return "warning" as const;
}

export default function AdminCommunityDistributionsPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const [title, setTitle] = React.useState("");
  const [distributionType, setDistributionType] = React.useState<(typeof DISTRIBUTION_TYPES)[number]>("FOOD");
  const [beneficiaryCount, setBeneficiaryCount] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { data, refetch } = useGetAdminCommunityDistributionsQuery({
    page,
    pageSize,
    status: statusFilter || undefined,
  });
  const [createDistribution, { isLoading: creating }] = useCreateAdminCommunityDistributionMutation();
  const [approveDistribution] = useApproveAdminCommunityDistributionMutation();
  const [completeDistribution] = useCompleteAdminCommunityDistributionMutation();
  const [deleteDistribution, { isLoading: deleting }] = useDeleteAdminCommunityDistributionMutation();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetForm() {
    setTitle("");
    setDistributionType("FOOD");
    setBeneficiaryCount("");
    setAmount("");
    setLocation("");
    setNotes("");
  }

  async function submitCreate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const count = Number(beneficiaryCount);
    const amt = Number(amount);
    if (!Number.isFinite(count) || count < 1) {
      toast.error("Beneficiary count must be at least 1");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    try {
      await createDistribution({
        title: title.trim(),
        distributionType,
        beneficiaryCount: count,
        amount: amt,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success("Community distribution created");
      setCreateOpen(false);
      resetForm();
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Create failed");
    }
  }

  async function submitDelete() {
    if (!selectedId) return;
    try {
      await deleteDistribution({ id: selectedId }).unwrap();
      toast.success("Distribution deleted");
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
        title="New Community Distribution"
        onSave={submitCreate}
        saveLoading={creating}
        saveDisabled={!title.trim() || !beneficiaryCount || !amount || Number(amount) <= 0 || Number(beneficiaryCount) < 1}
      >
        <div className="space-y-4">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ramadan food campaign" className="border-[#b5cec4] bg-white text-black" />
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
          <FormField label="Beneficiary Count">
            <Input value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(e.target.value)} type="number" min="1" step="1" placeholder="100" className="border-[#b5cec4] bg-white text-black" />
          </FormField>
          <FormField label="Amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="border-[#b5cec4] bg-white text-black" />
          </FormField>
          <FormField label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="District / camp / village" className="border-[#b5cec4] bg-white text-black" />
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
        title="Delete Community Distribution"
        saveLabel="Delete"
        saveVariant="destructive"
        onSave={submitDelete}
        saveLoading={deleting}
      >
        <p className="text-sm text-black/80">
          Are you sure you want to delete this community distribution? This action cannot be undone.
        </p>
      </FadeModal>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Community Distributions</CardTitle>
            <div className="text-sm text-black/60">Mass and group aid without individual beneficiary registration</div>
          </div>
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
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
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm text-black"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#065F46]">Title</TableHead>
                <TableHead className="text-[#065F46]">Type</TableHead>
                <TableHead className="text-[#065F46]">Beneficiaries</TableHead>
                <TableHead className="text-[#065F46]">Amount</TableHead>
                <TableHead className="text-[#065F46]">Location</TableHead>
                <TableHead className="text-[#065F46]">Status</TableHead>
                <TableHead className="text-[#065F46]">Admin</TableHead>
                <TableHead className="text-[#065F46]">Created</TableHead>
                <TableHead className="text-[#065F46]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-[200px] truncate text-black" title={d.title}>
                    {d.title}
                  </TableCell>
                  <TableCell className="text-black">{d.distributionType}</TableCell>
                  <TableCell className="text-black">{d.beneficiaryCount}</TableCell>
                  <TableCell className="text-black">{d.amount}</TableCell>
                  <TableCell className="text-black">{d.location ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-black">{d.adminName ?? "-"}</TableCell>
                  <TableCell className="text-black">{new Date(d.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {d.status === "PENDING" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await approveDistribution({ id: d.id }).unwrap();
                              toast.success("Distribution approved and journal posted");
                              await refetch();
                            } catch (e) {
                              const err = e as { data?: { error?: string } };
                              toast.error(err?.data?.error ?? "Approve failed");
                            }
                          }}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {d.status === "APPROVED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await completeDistribution({ id: d.id }).unwrap();
                              toast.success("Distribution marked complete");
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
                      {d.status === "PENDING" || d.status === "APPROVED" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedId(d.id);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-black/60">
                    No community distributions yet
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-black/60">
              Page {page} of {totalPages} ({total} total)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
