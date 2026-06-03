"use client";

import * as React from "react";
import { useGetAdminAuditQuery } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FadeModal } from "@/components/common/fade-modal";
import { Eye, Filter } from "lucide-react";

export default function AdminAuditPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [q, setQ] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const { data, isFetching } = useGetAdminAuditQuery({ page, pageSize, q: q || undefined, module: moduleFilter || undefined });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selected = data?.items?.find((x) => x.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl font-semibold text-[#0f172a]">Audit Trials</CardTitle>
          <div className="text-sm text-black/60">View and monitor system audit trails and user actions.</div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-4">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by action, module, user, IP address..."
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
              />
            </div>
            <div>
              <div className="flex h-10 items-center rounded-md border border-black/10 bg-white px-2">
                <Filter className="mr-2 h-4 w-4 text-black/50" />
                <select
                  value={moduleFilter}
                  onChange={(e) => {
                    setModuleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent text-sm text-black outline-none"
                >
                  <option value="">All Modules</option>
                  {(data?.modules ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

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
                  <TableHead>Full Name</TableHead>
                  <TableHead>MODULE</TableHead>
                  <TableHead>ACTION</TableHead>
                  <TableHead>PATH</TableHead>
                  <TableHead>DATE</TableHead>
                  <TableHead>ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[220px] text-black">
                      <div className="font-semibold">{a.user?.name ?? (a.userId ? `#${a.userId}` : "-")}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.module}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[380px] truncate text-black">{a.action}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-black">{a.path}</TableCell>
                    <TableCell className="text-black">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(a.id)} className="text-black/80 hover:text-[#065F46]">
                        <Eye className="mr-1 h-4 w-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-sm text-black/60">No audit logs yet.</div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-black/80">
              {total > 0
                ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total}`
                : "Showing 0 of 0"}
            </div>
            <div className="flex gap-2">
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

      <FadeModal
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelectedId(null)}
        title="Audit Trial Details"
        className="sm:max-w-[900px]"
        titleClassName="text-[#0f172a] text-[40px]"
      >
          {selected ? (
            <div className="w-full">
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-black/60">User</div>
                  <div className="font-semibold text-black">{selected.user?.name ?? (selected.userId ? `#${selected.userId}` : "-")}</div>
                </div>
                <div>
                  <div className="text-sm text-black/60">Module</div>
                  <div className="font-semibold text-black">{selected.module}</div>
                </div>
                <div>
                  <div className="text-sm text-black/60">Date of Action</div>
                  <div className="font-semibold text-black">{new Date(selected.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-black/60">Browser</div>
                  <div className="font-semibold text-black">{selected.browser}</div>
                </div>
                <div>
                  <div className="text-sm text-black/60">IP Address</div>
                  <div className="font-semibold text-black">{selected.ip}</div>
                </div>
                <div>
                  <div className="text-sm text-black/60">Path</div>
                  <div className="font-semibold text-black break-all">{selected.path}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-black/60">Action</div>
                <div className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/[0.03] p-3 font-medium text-black">
                  {selected.action}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-black/60">System Information</div>
                <div className="mt-1 rounded-lg bg-black/[0.03] p-3 text-black">
                  <span className="font-semibold">Operating System:</span> {selected.os}
                </div>
              </div>
            </div>
          ) : null}
      </FadeModal>
    </div>
  );
}

