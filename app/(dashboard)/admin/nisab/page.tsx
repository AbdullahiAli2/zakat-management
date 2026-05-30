"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGetAdminNisabQuery,
  useGetAdminOverviewQuery,
  useGetSystemWalletQuery,
  useUpdateAdminNisabMutation,
} from "@/store/api";
import { formatCurrency } from "@/lib/currency";

export default function AdminNisabPage() {
  const { data: nisab, refetch: refetchNisab } = useGetAdminNisabQuery();
  const { data: wallet } = useGetSystemWalletQuery();
  const { data: overview } = useGetAdminOverviewQuery();
  const [updateNisab, { isLoading: savingNisab }] = useUpdateAdminNisabMutation();

  const [goldPricePerGram, setGoldPricePerGram] = React.useState("");

  React.useEffect(() => {
    if (nisab?.goldPricePerGram) setGoldPricePerGram(String(nisab.goldPricePerGram));
  }, [nisab]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-[#065F46]">Gold-based Nisab (Reference)</CardTitle>
          <div className="text-sm text-black/60">
            Gold is used only to determine the Nisab threshold (minimum wealth). Zakat for both{" "}
            <span className="font-semibold">Maal</span> and <span className="font-semibold">Business</span> is{" "}
            <span className="font-semibold">1/40 = 2.5%</span> of eligible wealth once above Nisab.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-black/70">
            Current Nisab Value:{" "}
            <span className="font-semibold text-black">{formatCurrency(nisab?.nisabValue ?? 0)}</span>
          </div>
          <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/80">
            Example: If eligible wealth = <span className="font-semibold">$20,000</span>, then Zakat due = $20,000 × 0.025 ={" "}
            <span className="font-semibold">$500</span>.
          </div>
          <div className="text-sm text-black/70">
            Current Gold Price (1g):{" "}
            <span className="font-semibold text-black">{formatCurrency(nisab?.goldPricePerGram ?? 0)}</span>{" "}
            <span className="text-xs text-black/55">(this is 1 gram price)</span>
          </div>
          <Input
            value={goldPricePerGram}
            onChange={(e) => setGoldPricePerGram(e.target.value)}
            placeholder="Gold price (1g)"
            className="bg-white text-black"
            type="number"
          />
          <Button
            className="bg-[#065F46] text-white hover:bg-[#054e3a]"
            disabled={savingNisab}
            onClick={async () => {
              try {
                await updateNisab({ goldPricePerGram: Number(goldPricePerGram) }).unwrap();
                toast.success("Nisab updated");
                await refetchNisab();
              } catch (e) {
                const err = e as { data?: { error?: string } };
                toast.error(err?.data?.error ?? "Failed to update nisab");
              }
            }}
          >
            Save Nisab
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#065F46]">System Wallet</CardTitle>
          <div className="text-sm text-black/60">Central pool based on successful payment/distribution transactions</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-[#065F46]/20 bg-[#065F46]/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-black/55">Bank Account Balance</div>
            <div className="mt-2 text-3xl font-bold text-[#065F46]">{formatCurrency(wallet?.balance ?? 0)}</div>
            <div className="mt-1 text-xs text-black/55">Computed from SUCCESS transactions only.</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="text-xs font-semibold uppercase text-black/50">+ Total Collected (Approved Zakat)</div>
              <div className="mt-1 text-lg font-bold text-[#166534]">{formatCurrency(overview?.totalZakatCollected ?? "0")}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="text-xs font-semibold uppercase text-black/50">- Total Distributed</div>
              <div className="mt-1 text-lg font-bold text-[#8b5e00]">-{formatCurrency(overview?.totalDistributed ?? "0")}</div>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-black/50">Net Remaining Balance</div>
            <div className="mt-1 text-lg font-bold text-[#065F46]">{formatCurrency(overview?.remainingBalance ?? wallet?.balance ?? 0)}</div>
          </div>

          <div className="rounded-md border border-[#065F46]/20 bg-[#065F46]/5 px-3 py-2 text-sm text-black/80">
            System wallet is automatic. It increases from approved zakat payments and decreases from distributions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

