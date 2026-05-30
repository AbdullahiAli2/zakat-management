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
  useCreateAdminBeneficiaryMutation,
  useDeleteAdminBeneficiaryMutation,
  useGetAdminBeneficiariesQuery,
  useUpdateAdminBeneficiaryMutation,
  useVerifyAdminBeneficiaryMutation,
} from "@/store/api";

const CATEGORIES = ["POOR", "ORPHAN", "WIDOW", "DISABLED", "STUDENT", "EMERGENCY"] as const;
const STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;

function statusBadge(status: string) {
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">Rejected</Badge>;
  if (status === "UNDER_REVIEW") return <Badge variant="secondary">Under review</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

export default function AdminBeneficiariesPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gender, setGender] = React.useState<"" | "MALE" | "FEMALE">("");
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>("POOR");
  const [familySize, setFamilySize] = React.useState("");
  const [address, setAddress] = React.useState("");

  const { data, refetch } = useGetAdminBeneficiariesQuery({
    page,
    pageSize,
    q: q || undefined,
    status: statusFilter || undefined,
  });
  const [createBeneficiary, { isLoading: creating }] = useCreateAdminBeneficiaryMutation();
  const [updateBeneficiary, { isLoading: updating }] = useUpdateAdminBeneficiaryMutation();
  const [verifyBeneficiary, { isLoading: verifying }] = useVerifyAdminBeneficiaryMutation();
  const [deleteBeneficiary, { isLoading: deleting }] = useDeleteAdminBeneficiaryMutation();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setGender("");
    setCategory("POOR");
    setFamilySize("");
    setAddress("");
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(item: NonNullable<typeof data>["items"][number]) {
    setSelectedId(item.id);
    setFirstName(item.firstName ?? "");
    setLastName(item.lastName ?? "");
    setPhone(item.phone ?? "");
    setGender(item.gender ?? "");
    setCategory(item.category);
    setFamilySize(item.familySize != null ? String(item.familySize) : "");
    setAddress(item.address ?? "");
    setEditOpen(true);
  }

  async function submitCreate() {
    try {
      await createBeneficiary({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        category,
        familySize: familySize ? Number(familySize) : undefined,
        address: address.trim() || undefined,
      }).unwrap();
      toast.success("Beneficiary created");
      setCreateOpen(false);
      resetForm();
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Create beneficiary failed");
    }
  }

  async function submitEdit() {
    if (!selectedId) return;
    try {
      await updateBeneficiary({
        id: selectedId,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        gender: gender || null,
        category,
        familySize: familySize ? Number(familySize) : null,
        address: address.trim() || null,
      }).unwrap();
      toast.success("Beneficiary updated");
      setEditOpen(false);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Update beneficiary failed");
    }
  }

  async function setStatus(id: number, status: (typeof STATUSES)[number]) {
    try {
      await verifyBeneficiary({ id, status }).unwrap();
      toast.success(`Status set to ${status.replace("_", " ").toLowerCase()}`);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Verification update failed");
    }
  }

  async function submitDelete() {
    if (!selectedId) return;
    try {
      await deleteBeneficiary({ id: selectedId }).unwrap();
      toast.success("Beneficiary deleted");
      setDeleteOpen(false);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "Delete beneficiary failed");
    }
  }

  const formFields = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First Name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter first name" className="border-[#b5cec4] bg-white text-black" />
        </FormField>
        <FormField label="Last Name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter last name" className="border-[#b5cec4] bg-white text-black" />
        </FormField>
      </div>
      <FormField label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone" className="border-[#b5cec4] bg-white text-black" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Gender">
          <FormSelect value={gender} onChange={(e) => setGender(e.target.value as "" | "MALE" | "FEMALE")}>
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </FormSelect>
        </FormField>
        <FormField label="Category">
          <FormSelect value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FormSelect>
        </FormField>
      </div>
      <FormField label="Family Size">
        <Input
          type="number"
          min={1}
          value={familySize}
          onChange={(e) => setFamilySize(e.target.value)}
          placeholder="Enter family size"
          className="border-[#b5cec4] bg-white text-black"
        />
      </FormField>
      <FormField label="Address">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address" className="border-[#b5cec4] bg-white text-black" />
      </FormField>
    </div>
  );

  return (
    <>
      <FadeModal open={createOpen} onOpenChange={setCreateOpen} title="Add Beneficiary" onSave={submitCreate} saveLoading={creating}>
        {formFields}
      </FadeModal>

      <FadeModal open={editOpen} onOpenChange={setEditOpen} title="Edit Beneficiary" onSave={submitEdit} saveLoading={updating}>
        {formFields}
      </FadeModal>

      <FadeModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Beneficiary"
        saveLabel="Delete"
        saveVariant="destructive"
        onSave={submitDelete}
        saveLoading={deleting}
      >
        <p className="text-sm text-black/80">Are you sure you want to delete this beneficiary?</p>
      </FadeModal>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Beneficiaries</CardTitle>
            <div className="text-sm text-black/60">Register and verify zakat beneficiaries</div>
          </div>
          <Button className="shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Beneficiary
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone, or ID..."
              className="bg-white text-black md:col-span-2"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
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
            </select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#065F46]">Name</TableHead>
                <TableHead className="text-[#065F46]">Category</TableHead>
                <TableHead className="text-[#065F46]">Status</TableHead>
                <TableHead className="text-[#065F46]">Created</TableHead>
                <TableHead className="text-right text-[#065F46]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-black">{b.fullName}</TableCell>
                  <TableCell className="text-black">{b.category}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell className="text-black">{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {b.status === "PENDING" ? (
                        <Button variant="outline" size="sm" disabled={verifying} onClick={() => setStatus(b.id, "UNDER_REVIEW")}>
                          Review
                        </Button>
                      ) : null}
                      {b.status === "UNDER_REVIEW" ? (
                        <>
                          <Button variant="outline" size="sm" disabled={verifying} onClick={() => setStatus(b.id, "APPROVED")}>
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" disabled={verifying} onClick={() => setStatus(b.id, "REJECTED")}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          setSelectedId(b.id);
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
                    No beneficiaries found.
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
