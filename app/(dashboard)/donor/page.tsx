"use client";

import Link from "next/link";
import { useGetAccountsMeQuery, useGetMeQuery, useGetTransactionsQuery, useGetZakatSummaryQuery } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardStatCard, QuickLinkGrid, ZakatDueBanner, ZakatStatusNotice } from "@/components/dashboard/dashboard-widgets";
import { BookOpen, HandCoins, ScrollText, User, Wallet } from "lucide-react";

export default function DonorDashboardPage() {
  const { data: accountMe, isLoading: meLoading } = useGetAccountsMeQuery();
  const { data: me } = useGetMeQuery();
  const firstName = (me?.name ?? "Donor").split(" ")[0];
  const { data: latestTx, isFetching: latestTxLoading } = useGetTransactionsQuery({ page: 1, pageSize: 5 });

  const maalAmount = Number(accountMe?.balance ?? 0);
  const accountCount = accountMe?.accounts?.length ?? 0;
  const primaryAccountId = accountMe?.accounts?.[0]?.id;
  const summarySkip = meLoading || (!primaryAccountId && maalAmount <= 0);
  const { data: zakatSummary, isFetching: summaryLoading } = useGetZakatSummaryQuery(
    primaryAccountId ? { accountId: primaryAccountId } : maalAmount > 0 ? { amount: maalAmount } : {},
    { skip: summarySkip },
  );

  const nisabValue = Number(zakatSummary?.nisabValue ?? 0);
  const progressPct =
    nisabValue > 0 ? Math.max(0, Math.min(100, Math.round((maalAmount / nisabValue) * 100))) : 0;
  const nisabChecked = zakatSummary?.belowNisab === false;
  const needsToPay = zakatSummary?.zakatDue === true;
  const remainingDue = Number(zakatSummary?.remainingDue ?? 0);
  const calculatedZakat = Number(zakatSummary?.calculatedZakat ?? 0);
  const paidThisCycle = Number(zakatSummary?.paidThisCycle ?? 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#1f5a2a] bg-[#2a6528] px-4 py-5 text-white shadow-sm md:px-8 md:py-6">
        <div className="grid items-center gap-6">
          <div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Salam, {firstName}.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-[1.45] text-white/85 sm:text-base">
              Track your wealth, fulfill your zakat obligation, and see your giving history in one place.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {needsToPay ? (
                <Link href="/donor/pay-zakat">
                  <Button className="h-9 rounded-full bg-[#967100] px-5 text-sm font-semibold text-white hover:bg-[#7d5f00]">
                    Pay Zakat Now
                  </Button>
                </Link>
              ) : null}
              <Link href="/donor/accounts">
                <Button className="h-9 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20">
                  Manage Accounts
                </Button>
              </Link>
              <Link href="/donor/guide">
                <Button className="h-9 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20">
                  Zakat Guide
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ZakatDueBanner summary={zakatSummary} loading={summaryLoading || summarySkip} />
      <ZakatStatusNotice
        summary={zakatSummary}
        loading={summaryLoading || summarySkip}
        walletBalance={maalAmount}
        nisabValue={nisabValue}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          title="Wallet Balance"
          value={formatCurrency(accountMe?.balance ?? "0")}
          loading={meLoading}
          hint={`${accountCount} account${accountCount === 1 ? "" : "s"}`}
        />
        <DashboardStatCard
          title="Total Zakat Paid"
          value={formatCurrency(accountMe?.totalZakatPaid ?? "0")}
          loading={meLoading}
        />
        <DashboardStatCard
          title="Zakat Due"
          value={
            summaryLoading || summarySkip
              ? "—"
              : needsToPay
                ? formatCurrency(remainingDue)
                : nisabChecked
                  ? formatCurrency(0)
                  : "—"
          }
          loading={summaryLoading || meLoading}
          hint={
            needsToPay ? "Payment required" : nisabChecked ? "Nothing owed this cycle" : "Below Nisab"
          }
          className={needsToPay ? "border-[#065F46]/30 bg-[#f0f9f6]/50" : undefined}
        />
        <DashboardStatCard
          title="Calculated Zakat (2.5%)"
          value={summaryLoading || summarySkip ? "—" : nisabChecked ? formatCurrency(calculatedZakat) : "—"}
          loading={summaryLoading || meLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#065F46]">Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickLinkGrid
            links={[
              { href: "/donor/pay-zakat", label: "Pay Zakat", description: "Submit your obligation", icon: HandCoins },
              { href: "/donor/accounts", label: "Accounts", description: "Wallets & balances", icon: Wallet },
              { href: "/donor/transactions", label: "Transactions", description: "Payment history", icon: ScrollText },
              { href: "/donor/guide", label: "Zakat Guide", description: "Learn & calculate", icon: BookOpen },
              { href: "/profile", label: "My Profile", description: "Personal details", icon: User },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden rounded-2xl border border-[#1f5a2a] bg-[#2a6528] p-5 text-white shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#f4d35e] via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                Personal Wallet
              </div>
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/75">Current Balance</div>
                <div className="mt-2 text-4xl font-extrabold leading-none">
                  {meLoading ? "—" : formatCurrency(accountMe?.balance ?? "0")}
                </div>
              </div>
              <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-white/10 sm:flex">
                <Wallet className="h-7 w-7 text-white/90" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {needsToPay ? (
                <Link href="/donor/pay-zakat">
                  <Button className="h-9 rounded-full bg-white px-5 text-sm font-semibold text-[#065F46] hover:bg-white/90">
                    Pay Zakat Now
                  </Button>
                </Link>
              ) : null}
              <Link href="/donor/accounts">
                <Button className="h-9 rounded-full bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20">
                  Add / Edit Accounts
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-[#065F46]">Nisab Status</div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                nisabChecked ? "border-[#16a34a]/20 bg-[#dcfce7] text-[#166534]" : "border-[#f59e0b]/20 bg-[#fef3c7] text-[#92400e]"
              }`}
            >
              {summaryLoading ? "…" : nisabChecked ? "ABOVE NISAB" : "BELOW NISAB"}
            </span>
          </div>

          <div className="mt-2 text-sm text-black/60">
            {summaryLoading
              ? "Loading threshold…"
              : `Your wealth is ${nisabChecked ? "at or above" : "below"} the gold-based Nisab threshold.`}
          </div>

          <div className="mt-4 rounded-xl border border-black/10 bg-[#F8FAF8] p-4">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-black/50">
              <span>Progress to Nisab</span>
              <span>
                {formatCurrency(maalAmount)} / {formatCurrency(nisabValue || 0)}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-black/10">
              <div className="h-2 rounded-full bg-[#8A6F00]" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-2 text-[11px] text-black/50">Nisab = 85g gold at current market price.</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[#F8FAF8] p-3">
              <div className="text-xs text-black/50">Paid this cycle</div>
              <div className="font-bold text-[#065F46]">{formatCurrency(paidThisCycle)}</div>
            </div>
            <div className="rounded-lg bg-[#F8FAF8] p-3">
              <div className="text-xs text-black/50">Remaining due</div>
              <div className="font-bold text-[#065F46]">{needsToPay ? formatCurrency(remainingDue) : nisabChecked ? formatCurrency(0) : "—"}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold text-[#065F46] sm:text-2xl">Latest transactions</CardTitle>
          <Link href="/donor/transactions" className="text-sm font-semibold text-[#065F46] hover:underline">
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
            <div className="py-8 text-sm text-black/60">No transactions yet. Pay zakat or add funds to get started.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
