"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreatePermissionMutation, useDeletePermissionMutation, useGetPermissionsQuery, useUpdatePermissionMutation } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const createSchema = z.object({
  codename: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(2),
});
const editSchema = z.object({
  codename: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(2),
});

export default function AdminPermissionsPage() {
  const { data, refetch } = useGetPermissionsQuery();
  const [createPermission] = useCreatePermissionMutation();
  const [updatePermission] = useUpdatePermissionMutation();
  const [deletePermission] = useDeletePermissionMutation();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const editItem = data?.find((p) => p.id === editId);

  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { codename: "", name: "" } });
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { codename: "", name: "" } });

  React.useEffect(() => {
    if (editItem) editForm.reset({ codename: editItem.codename, name: editItem.name });
  }, [editItem, editForm]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Permissions</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>Add Permission</Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codename</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codename}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditId(p.id)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={async () => {
                        if (!confirm(`Delete permission ${p.codename}?`)) return;
                        await deletePermission({ id: p.id }).unwrap();
                        toast.success("Permission deleted");
                        await refetch();
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <DialogHeader>
            <DialogTitle>Create Permission</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 pt-3"
            onSubmit={createForm.handleSubmit(async (values) => {
              await createPermission(values).unwrap();
              toast.success("Permission created");
              setCreateOpen(false);
              createForm.reset();
              await refetch();
            })}
          >
            <Input placeholder="Codename e.g. USERS_ADD" {...createForm.register("codename")} />
            <Input placeholder="Display name" {...createForm.register("name")} />
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editId)} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 pt-3"
            onSubmit={editForm.handleSubmit(async (values) => {
              if (!editId) return;
              await updatePermission({ id: editId, ...values }).unwrap();
              toast.success("Permission updated");
              setEditId(null);
              await refetch();
            })}
          >
            <Input placeholder="Codename" {...editForm.register("codename")} />
            <Input placeholder="Display name" {...editForm.register("name")} />
            <Button type="submit">Update</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

