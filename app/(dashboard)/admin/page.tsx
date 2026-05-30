"use client";

import Link from "next/link";
import {
  useGetAdminBeneficiariesQuery,
  useGetAdminCommunityDistributionsQuery,
  useGetAdminDistributionSummaryQuery,
  useGetAdminNisabQuery,
  useGetAdminOverviewQuery,
  useGetMeQuery,
  useGetTransactionsQuery,
} from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { DashboardStatCard, PendingAlert, QuickLinkGrid } from "@/components/dashboard/dashboard-widgets";
import { DistributionByCategoryCard } from "@/components/dashboard/distribution-by-category-card";
import {
  Activity,
  ClipboardList,
  HandCoins,
  Receipt,
  ScrollText,
  Shield,
  Users,
  UserCheck,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { data: me } = useGetMeQuery();
  const { data, isFetching } = useGetAdminOverviewQuery();
  const { data: summary, isFetching: summaryLoading } = useGetAdminDistributionSummaryQuery();
  const { data: nisab, isFetching: nisabLoading } = useGetAdminNisabQuery();
  const { data: latestTx, isFetching: latestTxLoading } = useGetTransactionsQuery({ page: 1, pageSize: 5 });
  const { data: pendingBeneficiaries } = useGetAdminBeneficiariesQuery({ page: 1, pageSize: 1, status: "PENDING" });
  const { data: pendingCommunity } = useGetAdminCommunityDistributionsQuery({ page: 1, pageSize: 1, status: "PENDING" });

  const firstName = (me?.name ?? "Admin").split(" ")[0];

  const pendingBeneficiaryCount = pendingBeneficiaries?.total ?? 0;
  const pendingCommunityCount = pendingCommunity?.total ?? 0;
  const pendingReviewCount = pendingBeneficiaryCount + pendingCommunityCount;
  const hasPending = pendingReviewCount > 0;
  const poolBalance = Number(data?.remainingBalance ?? 0);

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#1f5a2a] bg-[#2a6528] px-5 py-6 text-white shadow-sm md:px-10 md:py-8">
        <div className="grid items-center gap-6">
          <div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Salam, {firstName}.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-[1.45] text-white/85 sm:text-base">
              Monitor zakat collection, verify beneficiaries, and manage distributions from one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/pay-zakat">
                <Button className="h-9 rounded-full bg-[#967100] px-6 text-sm font-semibold text-white hover:bg-[#7d5f00] sm:h-10 sm:px-7">
                  Pay Zakat
                </Button>
              </Link>
              <Link href="/admin/beneficiaries">
                <Button className="h-9 rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20 sm:h-10 sm:px-7">
                  Review Beneficiaries
                </Button>
              </Link>
              <Link href="/admin/distributions">
                <Button className="h-9 rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20 sm:h-10 sm:px-7">
                  Distributions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {hasPending ? (
        <Card className="border-amber-200/60 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-amber-900">Pending actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <PendingAlert
              title="Beneficiaries awaiting review"
              count={pendingBeneficiaryCount}
              href="/admin/beneficiaries"
              label="Review"
            />
            <PendingAlert
              title="Community distributions pending approval"
              count={pendingCommunityCount}
              href="/admin/community-distributions"
              label="Open"
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Total Users" value={data?.totalUsers ?? 0} loading={isFetching} />
        <DashboardStatCard
          title="Zakat Collected"
          value={formatCurrency(data?.totalZakatCollected ?? "0")}
          loading={isFetching}
        />
        <DashboardStatCard
          title="Total Distributed"
          value={formatCurrency(data?.totalDistributed ?? "0")}
          loading={isFetching}
        />
        <DashboardStatCard
          title="Zakat Pool Balance"
          value={formatCurrency(poolBalance)}
          loading={isFetching}
          hint="Available for distributions"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard title="Transactions" value={data?.totalTransactions ?? 0} loading={isFetching} />
        <DashboardStatCard
          title="Distribution Records"
          value={data?.beneficiariesSupported ?? 0}
          loading={isFetching}
          hint="Individual distributions logged"
        />
        <DashboardStatCard
          title="Gold Nisab (85g)"
          value={nisabLoading ? "—" : formatCurrency(nisab?.nisabValue ?? data?.currentNisab ?? 0)}
          loading={nisabLoading}
        />
        <DashboardStatCard
          title="Pending Reviews"
          value={pendingReviewCount}
          loading={isFetching}
          hint={
            pendingReviewCount > 0
              ? `${pendingBeneficiaryCount} beneficiaries · ${pendingCommunityCount} community`
              : "Nothing awaiting approval"
          }
          className={pendingReviewCount > 0 ? "border-amber-200/80 bg-amber-50/40" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#065F46]">Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickLinkGrid
            links={[
              { href: "/admin/users", label: "Users", description: "Manage accounts & roles", icon: Users },
              { href: "/admin/beneficiaries", label: "Beneficiaries", description: "Register & verify", icon: UserCheck },
              { href: "/admin/distributions", label: "Distributions", description: "Individual aid", icon: HandCoins },
              { href: "/admin/community-distributions", label: "Community Aid", description: "Mass campaigns", icon: Activity },
              { href: "/admin/transactions", label: "Transactions", description: "Full ledger", icon: ScrollText },
              { href: "/admin/receipts", label: "Receipts", description: "Payment records", icon: Receipt },
              { href: "/admin/nisab", label: "Nisab & Wallet", description: "Threshold & pool", icon: Shield },
              { href: "/admin/audit", label: "Audit logs", description: "System activity", icon: ClipboardList },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DistributionByCategoryCard summary={summary} loading={summaryLoading} />

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-[#065F46]">Nisab & pool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[#8A6F00]/30 bg-[#F8FAF8] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Gold price (1g)</div>
              <div className="mt-2 text-3xl font-bold text-[#065F46]">
                {nisabLoading ? "—" : formatCurrency(nisab?.goldPricePerGram ?? 0)}
              </div>
              <div className="mt-1 text-xs text-black/60">Zakat rate: 2.5% when wealth ≥ Nisab</div>
            </div>
            <div className="rounded-xl bg-[#F8FAF8] p-4">
              <div className="text-xs font-semibold uppercase text-black/50">Nisab threshold (85g)</div>
              <div className="mt-1 text-2xl font-bold text-[#065F46]">
                {nisabLoading ? "—" : formatCurrency(nisab?.nisabValue ?? 0)}
              </div>
            </div>
            <Link href="/admin/nisab">
              <Button variant="outline" className="w-full">
                Manage Nisab settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold text-[#065F46] sm:text-2xl">Latest transactions</CardTitle>
          <Link href="/admin/transactions" className="text-sm font-semibold text-[#065F46] hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {latestTxLoading && !latestTx ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : latestTx?.items?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase text-black/45">Date</TableHead>
                  <TableHead className="text-[11px] uppercase text-black/45">Details</TableHead>
                  <TableHead className="text-[11px] uppercase text-black/45">Type</TableHead>
                  <TableHead className="text-[11px] uppercase text-black/45">Amount</TableHead>
                  <TableHead className="text-[11px] uppercase text-black/45">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestTx.items.map((t) => {
                  const statusClass =
                    t.status === "SUCCESS"
                      ? "bg-[#dcfce7] text-[#166534]"
                      : t.status === "PENDING"
                        ? "bg-[#fef3c7] text-[#92400e]"
                        : "bg-[#fee2e2] text-[#991b1b]";
                  const typeClass =
                    t.type === "ZAKAT_PAYMENT"
                      ? "bg-[#e0e7ff] text-[#3730a3]"
                      : t.type === "DEPOSIT"
                        ? "bg-[#dbeafe] text-[#1d4ed8]"
                        : "bg-[#f3e8ff] text-[#7e22ce]";
                  const isOut = t.type === "DISTRIBUTION";
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="text-sm font-semibold text-black/80">{new Date(t.date).toLocaleDateString()}</div>
                        <div className="text-[10px] uppercase tracking-wide text-black/35">Ref: {t.reference ?? "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-black">
                          {t.method === "-" ? "System transaction" : `${t.method} transaction`}
                        </div>
                        <div className="text-xs text-black/50">{t.type.replaceAll("_", " ")}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${typeClass}`}>{t.type}</span>
                      </TableCell>
                      <TableCell className={`text-xl font-bold ${isOut ? "text-[#8b5e00]" : "text-[#166534]"}`}>
                        {isOut ? "-" : ""}
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{t.status}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-sm text-black/60">No transactions yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
