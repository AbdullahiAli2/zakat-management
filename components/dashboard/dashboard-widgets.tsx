"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type ZakatSummarySnapshot = {
  zakatDue?: boolean | null;
  belowNisab?: boolean | null;
  remainingDue?: string | null;
  paidThisCycle?: string | null;
  pendingThisCycle?: string | null;
  hasPendingPayment?: boolean;
  calculatedZakat?: string | null;
};

/** Shown only when API reports zakat is owed (above Nisab and remaining due > 0). */
export function ZakatDueBanner({
  summary,
  loading,
  payHref = "/donor/pay-zakat",
}: {
  summary?: ZakatSummarySnapshot | null;
  loading?: boolean;
  payHref?: string;
}) {
  if (loading || summary?.zakatDue !== true) return null;

  const remainingDue = Number(summary.remainingDue ?? 0);
  const paidThisCycle = Number(summary.paidThisCycle ?? 0);

  return (
    <Card className="border-[#065F46]/20 bg-[#f0f9f6]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <div className="text-sm font-semibold text-[#065F46]">Zakat is due on your wealth</div>
          <div className="mt-1 text-2xl font-bold text-black">{formatCurrency(remainingDue)}</div>
          <div className="text-xs text-black/60">
            Calculated at 2.5% · {formatCurrency(paidThisCycle)} already paid this cycle
          </div>
        </div>
        <Link href={payHref}>
          <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]">Pay now</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function ZakatStatusNotice({
  summary,
  loading,
  walletBalance,
  nisabValue,
}: {
  summary?: ZakatSummarySnapshot | null;
  loading?: boolean;
  walletBalance: number;
  nisabValue: number;
}) {
  if (loading || !summary) return null;

  if (summary.belowNisab === true) {
    return (
      <Card className="border-amber-200/60 bg-amber-50/50">
        <CardContent className="py-4 text-sm text-amber-900">
          Your balance ({formatCurrency(walletBalance)}) is below the Nisab threshold ({formatCurrency(nisabValue)}).
          No zakat is due until your wealth reaches Nisab.
        </CardContent>
      </Card>
    );
  }

  if (summary.hasPendingPayment) {
    const pending = Number(summary.pendingThisCycle ?? 0);
    return (
      <Card className="border-amber-200/60 bg-amber-50/50">
        <CardContent className="py-4 text-sm text-amber-900">
          {pending > 0
            ? `${formatCurrency(pending)} zakat is waiting for admin approval. You cannot pay again until it is approved or rejected.`
            : "Your zakat payment is waiting for admin approval. You cannot pay again until it is approved or rejected."}
        </CardContent>
      </Card>
    );
  }

  if (summary.zakatDue === false && summary.belowNisab === false) {
    return (
      <Card className="border-[#16a34a]/20 bg-[#f0fdf4]">
        <CardContent className="py-4 text-sm text-[#166534]">
          You are up to date — no zakat payment is required this cycle.
          {Number(summary.paidThisCycle ?? 0) > 0
            ? ` (${formatCurrency(summary.paidThisCycle ?? 0)} approved this year.)`
            : ""}
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function DashboardStatCard({
  title,
  value,
  loading,
  hint,
  className,
}: {
  title: string;
  value: React.ReactNode;
  loading?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-black/5", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#065F46]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-black">
        {loading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold">{value}</div>}
        {hint ? <p className="mt-1 text-xs text-black/55">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function QuickLinkGrid({
  links,
}: {
  links: Array<{ href: string; label: string; description?: string; icon: LucideIcon }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-[#065F46]/30 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#065F46]/10 text-[#065F46] group-hover:bg-[#065F46] group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-black">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-xs text-black/55">{item.description}</span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function PendingAlert({
  title,
  count,
  href,
  label,
}: {
  title: string;
  count: number;
  href: string;
  label: string;
}) {
  if (count <= 0) return null;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:bg-amber-100/80"
    >
      <div>
        <div className="text-sm font-semibold text-amber-900">{title}</div>
        <div className="text-xs text-amber-800/80">{count} item{count === 1 ? "" : "s"} need attention</div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-[#065F46]">{label} →</span>
    </Link>
  );
}
