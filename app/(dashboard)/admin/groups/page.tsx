"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateGroupMutation, useDeleteGroupMutation, useGetGroupsQuery, useUpdateGroupMutation } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FadeModal } from "@/components/common/fade-modal";
import { Pencil, Shield, Trash2 } from "lucide-react";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Group name must be at least 2 characters")
    .max(100, "Group name must be at most 100 characters"),
});

export default function AdminGroupsPage() {
  const router = useRouter();
  const { data, refetch } = useGetGroupsQuery();
  const [createGroup] = useCreateGroupMutation();
  const [updateGroup] = useUpdateGroupMutation();
  const [deleteGroup] = useDeleteGroupMutation();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const editItem = data?.find((g) => g.id === editId);
  const filtered = React.useMemo(
    () => (data ?? []).filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q],
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const createForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  const editForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  React.useEffect(() => {
    if (editItem) editForm.reset({ name: editItem.name });
  }, [editItem, editForm]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Permission Groups</CardTitle>
            <div className="mt-1 text-sm text-[#065F46]/80">Manage permission groups and their settings</div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px]">
            <Input
              className="bg-white text-black placeholder:text-black/50 border-black/10"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search groups..."
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-black/55">Rows</label>
              <select
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]" onClick={() => setCreateOpen(true)}>
              + Add Group
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#065F46]">NAME</TableHead>
                <TableHead className="text-[#065F46]">PERMS*</TableHead>
                <TableHead className="text-[#065F46]">USERS*</TableHead>
                <TableHead className="text-[#065F46]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 font-medium text-[#065F46] hover:underline"
                      onClick={() => router.push(`/admin/apply-permissions?mode=GROUP_PERMISSIONS&groupId=${g.id}`)}
                    >
                      <span className="rounded-full bg-[#e7f6ef] p-1 text-[#065F46]">
                        <Shield className="h-3 w-3" />
                      </span>
                      {g.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-black">{g.permissionsCount}</TableCell>
                  <TableCell className="text-black">{g.usersCount}</TableCell>
                  <TableCell className="space-x-2">
                    <button type="button" className="text-[#065F46] hover:text-[#054e3a]" onClick={() => setEditId(g.id)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={async () => {
                        if (!confirm(`Delete group ${g.name}?`)) return;
                        await deleteGroup({ id: g.id }).unwrap();
                        toast.success("Group deleted");
                        await refetch();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-black/70">
            <div>
              {total > 0 ? `Showing ${start + 1} to ${Math.min(start + pageSize, total)} of ${total}` : "Showing 0 to 0 of 0"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="rounded-md border border-black/10 px-2 py-1 text-xs">{page}</span>
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

      <FadeModal open={createOpen} onOpenChange={setCreateOpen} title="Create Group" titleClassName="text-[#065F46] text-[30px]" className="sm:max-w-[700px]">
          <form
            className="grid gap-3 pt-3"
            onSubmit={createForm.handleSubmit(async (values) => {
              try {
                await createGroup(values).unwrap();
                toast.success("Group created");
                setCreateOpen(false);
                createForm.reset();
                await refetch();
              } catch (err) {
                const e = err as { data?: { error?: string } };
                toast.error(e?.data?.error ?? "Failed to create group");
              }
            })}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#065F46]">Group Name *</label>
              <Input className="bg-white text-black placeholder:text-black/50 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter group name" {...createForm.register("name")} />
              {createForm.formState.errors.name ? <div className="text-xs text-red-600">{createForm.formState.errors.name.message}</div> : null}
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]" type="submit">Save Group</Button>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            </div>
          </form>
      </FadeModal>

      <FadeModal open={Boolean(editId)} onOpenChange={(v) => !v && setEditId(null)} title="Edit Group" titleClassName="text-[#065F46] text-[30px]" className="sm:max-w-[700px]">
          <form
            className="grid gap-3 pt-3"
            onSubmit={editForm.handleSubmit(async (values) => {
              if (!editId) return;
              try {
                await updateGroup({ id: editId, ...values }).unwrap();
                toast.success("Group updated");
                setEditId(null);
                await refetch();
              } catch (err) {
                const e = err as { data?: { error?: string } };
                toast.error(e?.data?.error ?? "Failed to update group");
              }
            })}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#065F46]">Group Name *</label>
              <Input className="bg-white text-black placeholder:text-black/50 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter group name" {...editForm.register("name")} />
              {editForm.formState.errors.name ? <div className="text-xs text-red-600">{editForm.formState.errors.name.message}</div> : null}
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]" type="submit">Update Group</Button>
              <Button variant="outline" type="button" onClick={() => setEditId(null)}>Cancel</Button>
            </div>
          </form>
      </FadeModal>
    </div>
  );
}

