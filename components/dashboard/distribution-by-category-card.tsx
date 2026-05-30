"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";

const CATEGORY_LABELS: Record<string, string> = {
  POOR: "Poor & Needy",
  ORPHAN: "Orphans",
  WIDOW: "Widows",
  DISABLED: "Disabled",
  STUDENT: "Students",
  EMERGENCY: "Emergency Relief",
  COMMUNITY: "Community Aid",
};

const SLICE_COLORS = ["#065F46", "#8A6F00", "#2f7d32", "#1E40AF", "#0d9488", "#7c3aed", "#b45309"];

export type DistributionSummaryData = {
  total: number;
  individualTotal?: number;
  communityTotal?: number;
  items: Array<{ category: string; amount: number; percent: number }>;
};

function buildConicGradient(items: DistributionSummaryData["items"], total: number) {
  if (total <= 0) return "conic-gradient(#e5e7eb 0deg 360deg)";

  const slices = items.filter((i) => i.amount > 0);
  if (!slices.length) return "conic-gradient(#e5e7eb 0deg 360deg)";

  let acc = 0;
  const stops = slices.map((slice, index) => {
    const start = acc;
    acc += slice.percent;
    const color = SLICE_COLORS[index % SLICE_COLORS.length];
    return `${color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function DistributionByCategoryCard({
  summary,
  loading,
}: {
  summary?: DistributionSummaryData | null;
  loading?: boolean;
}) {
  const total = summary?.total ?? 0;
  const slices = (summary?.items ?? []).filter((i) => i.amount > 0);
  const allocatedPercent = slices.reduce((sum, i) => sum + i.percent, 0);
  const centerLabel = total > 0 ? `${allocatedPercent}%` : "—";
  const centerSub = total > 0 ? "OF TOTAL" : "NO DATA";

  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-2xl font-semibold text-[#065F46]">Distribution by Category</CardTitle>
          <div className="text-sm text-black/60">Approved & completed individual and community aid</div>
        </div>
        <Link href="/admin/distributions" className="shrink-0 text-sm font-semibold text-[#065F46] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : total <= 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-[#F8FAF8] px-6 py-12 text-center">
            <div className="text-lg font-semibold text-black/80">No distributions recorded yet</div>
            <p className="mt-2 max-w-md text-sm text-black/55">
              Complete or approve beneficiary distributions and community aid campaigns to see the breakdown here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/admin/distributions">
                <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]">Add distribution</Button>
              </Link>
              <Link href="/admin/community-distributions">
                <Button variant="outline">Community aid</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid items-center gap-4 md:grid-cols-2">
            <div className="flex justify-center">
              <div
                className="relative h-44 w-44 rounded-full"
                style={{ background: buildConicGradient(summary?.items ?? [], total) }}
              >
                <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white">
                  <div className="text-3xl font-bold text-[#065F46]">{centerLabel}</div>
                  <div className="text-[10px] font-medium tracking-wide text-black/50">{centerSub}</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {(summary?.items ?? []).map((item, index) => {
                const color = SLICE_COLORS[index % SLICE_COLORS.length];
                const label = CATEGORY_LABELS[item.category] ?? item.category;
                return (
                  <div
                    key={item.category}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-black">
                      <span className="inline-block h-6 w-2 shrink-0 rounded" style={{ backgroundColor: color }} />
                      <span className="truncate text-sm">{label}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-[#065F46]">{item.percent}%</div>
                      <div className="text-[11px] text-black/50">{formatCurrency(item.amount)}</div>
                    </div>
                  </div>
                );
              })}
              <div className="space-y-1 border-t border-black/10 pt-2 text-xs text-black/60">
                <div className="flex justify-between">
                  <span>Total distributed</span>
                  <span className="font-semibold text-black">{formatCurrency(total)}</span>
                </div>
                {summary?.individualTotal != null && summary.communityTotal != null ? (
                  <>
                    <div className="flex justify-between">
                      <span>Individual aid</span>
                      <span>{formatCurrency(summary.individualTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Community aid</span>
                      <span>{formatCurrency(summary.communityTotal)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
