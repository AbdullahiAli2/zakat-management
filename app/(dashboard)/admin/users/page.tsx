"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateAdminUserMutation,
  useDeleteAdminUserMutation,
  useResetUserPasswordMutation,
  useSearchUsersQuery,
  useUpdateAdminUserMutation,
  useUpdateUserRoleMutation,
} from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeModal } from "@/components/common/fade-modal";
import { UserPermissionsModal } from "@/components/admin/user-permissions-modal";
import { Eye, EyeOff, KeyRound, Pencil, Shield, Trash2 } from "lucide-react";
import { ageNumberSchema, MAX_HUMAN_AGE, MIN_HUMAN_AGE } from "@/lib/validation";

const roleValues = ["SUPERUSER", "ADMIN", "DONOR"] as const;
const staffRoleValues = ["SUPERUSER", "ADMIN"] as const;
const createSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(4, "Phone is required"),
  age: ageNumberSchema,
  gender: z.enum(["male", "female"]),
  country: z.string().min(2, "Country is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().min(2, "Address is required"),
  role: z.enum(staffRoleValues),
  isActive: z.boolean(),
});
const editSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(4, "Phone is required"),
  age: ageNumberSchema,
  gender: z.enum(["male", "female"]),
  country: z.string().min(2, "Country is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().min(2, "Address is required"),
  role: z.enum(roleValues),
  isActive: z.boolean(),
});
const resetSchema = z.object({
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export default function AdminUsersPage() {
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<string>("");
  const [isActive, setIsActive] = React.useState<string>(""); // "", "true", "false"
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const {
    data,
    isFetching,
    refetch: refetchUsers,
  } = useSearchUsersQuery({
    q: q || undefined,
    role: role || undefined,
    isActive: isActive ? isActive === "true" : undefined,
    page,
    pageSize,
  });

  const [updateUserRole] = useUpdateUserRoleMutation();
  const [createUser, { isLoading: creating }] = useCreateAdminUserMutation();
  const [updateUser, { isLoading: editing }] = useUpdateAdminUserMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteAdminUserMutation();
  const [resetPassword, { isLoading: resettingPassword }] = useResetUserPasswordMutation();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [resetId, setResetId] = React.useState<number | null>(null);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [permissionsUserId, setPermissionsUserId] = React.useState<number | null>(null);
  const [showCreatePassword, setShowCreatePassword] = React.useState(false);
  const [showResetPassword, setShowResetPassword] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      age: 18,
      gender: "male",
      country: "",
      city: "",
      address: "",
      role: "ADMIN",
      isActive: true,
    },
  });
  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", age: 18, gender: "male", country: "", city: "", address: "", role: "DONOR", isActive: true },
  });
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onUpdateUser(id: number, next: { role: string; isActive?: boolean }) {
    try {
      await updateUserRole({ id, role: next.role, isActive: next.isActive }).unwrap();
      toast.success("User updated");
      await refetchUsers();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Update failed");
    }
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const editingUser = data?.items.find((u) => u.id === editId);
  const resetUserRow = data?.items.find((u) => u.id === resetId);
  const deletingUserRow = data?.items.find((u) => u.id === deleteId);
  const permissionsUser = data?.items.find((u) => u.id === permissionsUserId);

  React.useEffect(() => {
    if (editingUser) {
      const names = editingUser.name.trim().split(/\s+/);
      editForm.reset({
        firstName: names[0] ?? "",
        lastName: names.slice(1).join(" ") || "User",
        email: editingUser.email,
        phone: editingUser.phone ?? "",
        age: editingUser.age ?? 18,
        gender: editingUser.gender === "female" ? "female" : "male",
        country: editingUser.country ?? "",
        city: editingUser.city ?? "",
        address: editingUser.address ?? "",
        role: (editingUser.role as "SUPERUSER" | "ADMIN" | "DONOR") ?? "ADMIN",
        isActive: editingUser.isActive,
      });
    }
  }, [editingUser, editForm]);

  async function onCreate(values: z.infer<typeof createSchema>) {
    try {
      await createUser(values).unwrap();
      toast.success("User created");
      setCreateOpen(false);
      createForm.reset();
      await refetchUsers();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Create failed");
    }
  }

  async function onEdit(values: z.infer<typeof editSchema>) {
    if (!editId) return;
    try {
      await updateUser({ id: editId, ...values }).unwrap();
      toast.success("User updated");
      setEditId(null);
      await refetchUsers();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Update failed");
    }
  }

  async function onReset(values: z.infer<typeof resetSchema>) {
    if (!resetId) return;
    try {
      await resetPassword({ id: resetId, newPassword: values.newPassword }).unwrap();
      toast.success("Password reset");
      setResetId(null);
      resetForm.reset();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Reset failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Users Management</CardTitle>
            <div className="mt-1 text-sm text-black/60">Manage system users and their permissions</div>
          </div>
          <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]" onClick={() => setCreateOpen(true)}>
            + Add User
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-2 md:col-span-3">
              <Input
                className="bg-white text-black placeholder:text-black/50 border-black/15"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users by name, email, or username..."
              />
            </div>
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Users</option>
                {roleValues.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                value={isActive}
                onChange={(e) => {
                  setIsActive(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Active</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
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
                    <TableHead className="text-[#065F46]">TYPE/ROLE</TableHead>
                    <TableHead className="text-[#065F46]">NAME</TableHead>
                    <TableHead className="text-[#065F46]">EMAIL</TableHead>
                    <TableHead className="text-[#065F46]">PHONE</TableHead>
                    <TableHead className="text-[#065F46]">LOCATION</TableHead>
                    <TableHead className="text-[#065F46]">STATUS</TableHead>
                    <TableHead className="text-[#065F46]">LAST LOGIN</TableHead>
                    <TableHead className="text-[#065F46]">CREATED AT</TableHead>
                    <TableHead className="text-[#065F46]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Badge variant="secondary">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-black">{u.name}</TableCell>
                      <TableCell className="text-black">{u.email}</TableCell>
                      <TableCell className="text-black">{u.phone || "-"}</TableCell>
                      <TableCell className="text-black">{u.city && u.country ? `${u.city}, ${u.country}` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="text-black">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "-"}</TableCell>
                      <TableCell className="text-black">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-black/70">
                          <button
                            type="button"
                            title={u.isActive ? "Deactivate user" : "Activate user"}
                            className="hover:text-black"
                            onClick={() => onUpdateUser(u.id, { role: u.role, isActive: !u.isActive })}
                          >
                            {u.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            title="Assign permissions"
                            className="text-[#065F46] hover:text-[#054e3a]"
                            onClick={() => setPermissionsUserId(u.id)}
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                          <button type="button" title="Reset password" className="text-amber-600 hover:text-amber-700" onClick={() => setResetId(u.id)}>
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button type="button" title="Edit user" className="text-[#0b4a7e] hover:text-[#093d68]" onClick={() => setEditId(u.id)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete user"
                            className="text-red-600 hover:text-red-700"
                            disabled={deleting}
                            onClick={() => setDeleteId(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-sm text-black/60">No users found.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-black/60">
              Showing <span className="font-semibold">{data?.items.length ?? 0}</span> of <span className="font-semibold">{total}</span> users - Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
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

      <UserPermissionsModal
        open={Boolean(permissionsUserId)}
        onOpenChange={(v) => !v && setPermissionsUserId(null)}
        userId={permissionsUserId}
        userName={permissionsUser?.name}
        userRole={permissionsUser?.role}
      />

      <FadeModal
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setShowCreatePassword(false);
        }}
        title="Create New User"
        titleClassName="text-[#065F46] text-[30px]"
        className="sm:max-w-[760px]"
        bodyClassName=""
      >
          <form className="grid gap-4 pt-2" onSubmit={createForm.handleSubmit(onCreate)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">First Name *</label>
                <Input
                  className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]"
                  placeholder="Enter first name"
                  {...createForm.register("firstName")}
                />
                {createForm.formState.errors.firstName ? <div className="text-xs text-red-600">{createForm.formState.errors.firstName.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Last Name *</label>
                <Input
                  className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]"
                  placeholder="Enter last name"
                  {...createForm.register("lastName")}
                />
                {createForm.formState.errors.lastName ? <div className="text-xs text-red-600">{createForm.formState.errors.lastName.message}</div> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#065F46]">Email Address *</label>
              <Input
                className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]"
                placeholder="Enter email address"
                {...createForm.register("email")}
              />
              {createForm.formState.errors.email ? <div className="text-xs text-red-600">{createForm.formState.errors.email.message}</div> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Phone *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter phone number" {...createForm.register("phone")} />
                {createForm.formState.errors.phone ? <div className="text-xs text-red-600">{createForm.formState.errors.phone.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Age *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" type="number" min={MIN_HUMAN_AGE} max={MAX_HUMAN_AGE} placeholder="Enter age" {...createForm.register("age", { valueAsNumber: true })} />
                {createForm.formState.errors.age ? <div className="text-xs text-red-600">{createForm.formState.errors.age.message}</div> : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Gender *</label>
                <select className="h-10 w-full rounded-md border border-[#b5cec4] bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20" {...createForm.register("gender")}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Country *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter country" {...createForm.register("country")} />
                {createForm.formState.errors.country ? <div className="text-xs text-red-600">{createForm.formState.errors.country.message}</div> : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">City *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter city" {...createForm.register("city")} />
                {createForm.formState.errors.city ? <div className="text-xs text-red-600">{createForm.formState.errors.city.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Address *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter address" {...createForm.register("address")} />
                {createForm.formState.errors.address ? <div className="text-xs text-red-600">{createForm.formState.errors.address.message}</div> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#065F46]">Password *</label>
              <div className="relative">
                <Input
                  className="bg-white pr-10 text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]"
                  placeholder="Enter password"
                  type={showCreatePassword ? "text" : "password"}
                  {...createForm.register("password")}
                />
                <button
                  type="button"
                  title={showCreatePassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/50 hover:text-[#065F46]"
                  onClick={() => setShowCreatePassword((v) => !v)}
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {createForm.formState.errors.password ? <div className="text-xs text-red-600">{createForm.formState.errors.password.message}</div> : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#065F46]">User Type *</label>
              <select
                className="h-10 w-full rounded-md border border-[#b5cec4] bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                {...createForm.register("role")}
              >
                {staffRoleValues.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-xs text-black/55">Donors register themselves on the public sign-up page.</p>
            </div>

            <label className="mt-1 flex items-center gap-2 text-sm text-black/80">
              <input className="accent-[#065F46]" type="checkbox" {...createForm.register("isActive")} />
              Active (User can login)
            </label>

            <div className="flex items-center gap-2 pt-2">
              <Button className="bg-[#065F46] px-6 text-white hover:bg-[#054e3a]" disabled={creating} type="submit">
                Create User
              </Button>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
      </FadeModal>

      <FadeModal
        open={Boolean(editId)}
        onOpenChange={(v) => !v && setEditId(null)}
        title="Edit User"
        titleClassName="text-[#065F46] text-[30px]"
        className="sm:max-w-[760px]"
        bodyClassName=""
      >
          <form className="grid gap-4 pt-2" onSubmit={editForm.handleSubmit(onEdit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">First Name *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter first name" {...editForm.register("firstName")} />
                {editForm.formState.errors.firstName ? <div className="text-xs text-red-600">{editForm.formState.errors.firstName.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Last Name *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter last name" {...editForm.register("lastName")} />
                {editForm.formState.errors.lastName ? <div className="text-xs text-red-600">{editForm.formState.errors.lastName.message}</div> : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#065F46]">Email Address *</label>
              <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter email address" {...editForm.register("email")} />
              {editForm.formState.errors.email ? <div className="text-xs text-red-600">{editForm.formState.errors.email.message}</div> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Phone *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter phone number" {...editForm.register("phone")} />
                {editForm.formState.errors.phone ? <div className="text-xs text-red-600">{editForm.formState.errors.phone.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Age *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" type="number" min={MIN_HUMAN_AGE} max={MAX_HUMAN_AGE} placeholder="Enter age" {...editForm.register("age", { valueAsNumber: true })} />
                {editForm.formState.errors.age ? <div className="text-xs text-red-600">{editForm.formState.errors.age.message}</div> : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Gender *</label>
                <select className="h-10 w-full rounded-md border border-[#b5cec4] bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20" {...editForm.register("gender")}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Country *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter country" {...editForm.register("country")} />
                {editForm.formState.errors.country ? <div className="text-xs text-red-600">{editForm.formState.errors.country.message}</div> : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">City *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter city" {...editForm.register("city")} />
                {editForm.formState.errors.city ? <div className="text-xs text-red-600">{editForm.formState.errors.city.message}</div> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#065F46]">Address *</label>
                <Input className="bg-white text-black placeholder:text-black/45 border-[#b5cec4] focus-visible:ring-[#065F46]/25 focus-visible:border-[#065F46]" placeholder="Enter address" {...editForm.register("address")} />
                {editForm.formState.errors.address ? <div className="text-xs text-red-600">{editForm.formState.errors.address.message}</div> : null}
              </div>
            </div>
            <select className="h-10 rounded-md border border-[#b5cec4] bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20" {...editForm.register("role")}>
              {roleValues.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label className="mt-1 flex items-center gap-2 text-sm text-black/80">
              <input className="accent-[#065F46]" type="checkbox" {...editForm.register("isActive")} />
              Active (User can login)
            </label>
            <div className="flex items-center gap-2 pt-2">
              <Button className="bg-[#065F46] px-6 text-white hover:bg-[#054e3a]" disabled={editing} type="submit">Update User</Button>
              <Button variant="outline" type="button" onClick={() => setEditId(null)}>Cancel</Button>
            </div>
          </form>
      </FadeModal>

      <FadeModal
        open={Boolean(resetId)}
        onOpenChange={(v) => {
          if (!v) {
            setResetId(null);
            setShowResetPassword(false);
            setShowResetConfirm(false);
          }
        }}
        title="Reset Password"
        titleClassName="text-[#065F46] text-[30px]"
        className="sm:max-w-[620px]"
      >
          <div className="mb-3 rounded-lg bg-[#f3f6fb] px-3 py-2 text-sm text-black/75">
            Resetting password for: <span className="font-semibold">{resetUserRow?.name ?? "-"}</span>
          </div>
          <form className="grid gap-3 pt-3" onSubmit={resetForm.handleSubmit(onReset)}>
            <div className="space-y-1">
              <div className="relative">
                <Input
                  className="bg-white pr-10 text-black placeholder:text-black/50 border-black/15"
                  placeholder="Enter new password (min. 8 characters)"
                  type={showResetPassword ? "text" : "password"}
                  {...resetForm.register("newPassword")}
                />
                <button
                  type="button"
                  title={showResetPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/50 hover:text-[#065F46]"
                  onClick={() => setShowResetPassword((v) => !v)}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="relative">
                <Input
                  className="bg-white pr-10 text-black placeholder:text-black/50 border-black/15"
                  placeholder="Confirm new password"
                  type={showResetConfirm ? "text" : "password"}
                  {...resetForm.register("confirmPassword")}
                />
                <button
                  type="button"
                  title={showResetConfirm ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/50 hover:text-[#065F46]"
                  onClick={() => setShowResetConfirm((v) => !v)}
                >
                  {showResetConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setResetId(null)}>
                Cancel
              </Button>
              <Button className="bg-[#065F46] hover:bg-[#054e3a]" disabled={resettingPassword} type="submit">
                Reset Password
              </Button>
            </div>
          </form>
      </FadeModal>

      <FadeModal
        open={Boolean(deleteId)}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete User"
        titleClassName="text-[#065F46] text-[30px]"
        className="sm:max-w-[560px]"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Are you sure you want to delete <span className="font-semibold">{deletingUserRow?.name ?? "this user"}</span>?
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async () => {
                if (!deleteId) return;
                await deleteUser({ id: deleteId }).unwrap();
                toast.success("User deleted");
                setDeleteId(null);
                await refetchUsers();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </FadeModal>
    </div>
  );
}

