"use client";

import * as React from "react";
import { HandCoins } from "lucide-react";
import { useGetAccountsMeQuery, usePayZakatMutation, useGetZakatSummaryQuery } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FadeModal } from "@/components/common/fade-modal";
import { FormField, FormSelect } from "@/components/common/form-field";
import { toast } from "sonner";
import { z } from "zod";
import { formatCurrency, parseCurrencyInput } from "@/lib/currency";
import { toastApiError } from "@/lib/client-errors";

const bodySchema = z.object({
  accountId: z.number().int().positive(),
  amount: z.number().positive(),
  zakatType: z.enum(["MAAL", "BUSINESS"]),
  method: z.enum(["EVCPLUS", "ZAAD", "E_DAHAB", "CASH", "WALLET"]),
});

export default function PayZakatPage() {
  const [payOpen, setPayOpen] = React.useState(false);
  const [amountInput, setAmountInput] = React.useState("");
  const [zakatType, setZakatType] = React.useState<"MAAL" | "BUSINESS">("MAAL");
  const [method, setMethod] = React.useState<"EVCPLUS" | "ZAAD" | "E_DAHAB" | "CASH" | "WALLET">("EVCPLUS");
  const [accountId, setAccountId] = React.useState<number | null>(null);
  const [receipt, setReceipt] = React.useState<{
    paymentId: number;
    user: { id: number; name: string; email: string };
    amount: string;
    date: string;
    zakatType: string;
    nisabValue: string;
  } | null>(null);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const { data: accountMe } = useGetAccountsMeQuery(undefined, { refetchOnMountOrArgChange: true });

  const amount = React.useMemo(() => parseCurrencyInput(amountInput), [amountInput]);
  const summarySkip = !accountId;
  const { data: summary, isFetching: summaryLoading } = useGetZakatSummaryQuery(
    { accountId: accountId ?? undefined },
    { skip: summarySkip, refetchOnMountOrArgChange: true },
  );
  const remainingDueNumber = Number(summary?.remainingDue ?? 0);
  const selectedAccount = React.useMemo(
    () => accountMe?.accounts?.find((a) => a.id === accountId),
    [accountMe, accountId],
  );
  const accountBalanceNumber = Number(selectedAccount?.balance ?? 0);

  const payBlockReason = React.useMemo(() => {
    if (!accountMe?.accounts?.length) return "Create a wallet account before paying zakat.";
    if (!accountId || summaryLoading) return null;
    if (summary?.hasPendingPayment) {
      const pending = Number(summary.pendingThisCycle ?? 0);
      return pending > 0
        ? `You have ${formatCurrency(pending)} zakat waiting for admin approval. You cannot submit another payment until it is approved or rejected.`
        : "You have a zakat payment waiting for admin approval. You cannot submit another payment until it is approved or rejected.";
    }
    if (summary?.belowNisab === true) {
      return `Your balance (${formatCurrency(accountBalanceNumber)}) is below Nisab (${formatCurrency(summary?.nisabValue ?? 0)}). No zakat is due on this wealth. Add funds when you reach Nisab.`;
    }
    if (remainingDueNumber <= 0) {
      return "You have no remaining zakat due for this cycle.";
    }
    if (accountBalanceNumber <= 0) {
      return "Your wallet balance is $0. Add money to your account before paying zakat.";
    }
    return null;
  }, [accountMe, accountId, summaryLoading, summary, accountBalanceNumber, remainingDueNumber]);

  const amountError = React.useMemo(() => {
    if (amount <= 0) return null;
    if (remainingDueNumber <= 0) return "No zakat is due this cycle — you cannot pay now.";
    if (amount > remainingDueNumber) {
      return `Amount cannot exceed ${formatCurrency(remainingDueNumber)} (remaining due this cycle).`;
    }
    if (amount > accountBalanceNumber) {
      return `Amount cannot exceed your wallet balance (${formatCurrency(accountBalanceNumber)}).`;
    }
    return null;
  }, [amount, remainingDueNumber, accountBalanceNumber]);

  const [payZakat, { isLoading: paying }] = usePayZakatMutation();

  React.useEffect(() => {
    if (accountId) return;
    const first = accountMe?.accounts?.[0];
    if (first) setAccountId(first.id);
  }, [accountMe, accountId]);

  function resetPayForm() {
    setAmountInput("");
    setZakatType("MAAL");
    setMethod("EVCPLUS");
    const first = accountMe?.accounts?.[0];
    setAccountId(first?.id ?? null);
  }

  function openPayModal() {
    if (payBlockReason) {
      toast.error(payBlockReason);
      return;
    }
    resetPayForm();
    setPayOpen(true);
  }

  const canSubmit =
    !paying &&
    !!accountId &&
    !summaryLoading &&
    !payBlockReason &&
    amount > 0 &&
    !amountError;

  async function submitPayment() {
    if (payBlockReason) {
      toast.error(payBlockReason);
      return;
    }
    if (amountError) {
      toast.error(amountError);
      return;
    }
    const remainingDue = remainingDueNumber;
    if (remainingDue <= 0) {
      toast.error("You have no remaining zakat due for this cycle.");
      return;
    }
    if (amount > remainingDue) {
      toast.error(`Amount cannot exceed ${formatCurrency(remainingDue)} (remaining due).`);
      return;
    }
    if (amount > accountBalanceNumber) {
      toast.error(`Amount cannot exceed your wallet balance (${formatCurrency(accountBalanceNumber)}).`);
      return;
    }
    const parsed = bodySchema.safeParse({ accountId, amount, zakatType, method });
    if (!parsed.success) {
      toast.error("Please select an account and enter a valid amount.");
      return;
    }

    try {
      const res = await payZakat(parsed.data).unwrap();
      setReceipt(res);
      setPayOpen(false);
      setReceiptOpen(true);
      toast.success("Zakat payment submitted — pending admin approval");
    } catch (err) {
      toastApiError(err, "Payment failed. Please check your amount and wallet balance.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Pay Zakat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-md border border-[#065F46]/20 bg-[#065F46]/5 px-3 py-2 text-xs text-[#065F46]">
              Zakat-only mode: payment is limited to your remaining Zakat due for this cycle.
            </div>

            {payBlockReason ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{payBlockReason}</div>
            ) : null}

            {summaryLoading && !summarySkip ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-40" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-[#fafafa] px-4 py-3">
                  <div>
                    <div className="text-xs text-black/60">Remaining Due This Cycle</div>
                    <div className="text-2xl font-semibold text-[#065F46]">{formatCurrency(summary?.remainingDue ?? 0)}</div>
                  </div>
                  {summary?.hasPendingPayment ? (
                    <Badge variant="warning">Pending Approval</Badge>
                  ) : summary?.belowNisab === true ? (
                    <Badge variant="warning">Below Nisab</Badge>
                  ) : summary?.remainingDue && Number(summary.remainingDue) <= 0 ? (
                    <Badge variant="secondary">Fulfilled</Badge>
                  ) : summary?.zakatDue === true ? (
                    <Badge variant="success">Zakat Due</Badge>
                  ) : (
                    <Badge variant="secondary">Select account</Badge>
                  )}
                </div>
                <p className="text-xs text-black/70">
                  Zakat (Maal/Business) rate is <span className="font-semibold">1/40 = 2.5%</span>. System accepts Zakat payment only up to
                  your remaining due for this cycle.
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={openPayModal}
              disabled={!accountMe?.accounts?.length || summaryLoading || !!payBlockReason}
            >
              <HandCoins className="h-4 w-4" />
              Pay Zakat
            </Button>
            {!accountMe?.accounts?.length ? (
              <p className="text-center text-xs text-black/60">Create a wallet account first before paying zakat.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {summaryLoading && summarySkip ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : summaryLoading && !summarySkip ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-52" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Account Balance</div>
                  <div className="text-sm font-semibold text-black">{formatCurrency(summary?.accountBalance ?? "0")}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Gold Nisab (85g × price per gram)</div>
                  <div className="text-sm font-semibold text-black">{formatCurrency(summary?.nisabValue ?? "0")}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Rate (1/40)</div>
                  <div className="text-sm font-semibold text-black">{summary?.rate ?? "0.025"}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Recommended Zakat</div>
                  <div className="text-sm font-semibold text-black">
                    {summary?.calculatedZakat ? formatCurrency(summary.calculatedZakat) : <span className="text-black/80">-</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Approved This Cycle</div>
                  <div className="text-sm font-semibold text-black">
                    {summary?.paidThisCycle ? formatCurrency(summary.paidThisCycle) : formatCurrency(0)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Pending Approval</div>
                  <div className="text-sm font-semibold text-black">
                    {summary?.pendingThisCycle ? formatCurrency(summary.pendingThisCycle) : formatCurrency(0)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Remaining Due</div>
                  <div className="text-sm font-semibold text-black">
                    {summary?.remainingDue ? formatCurrency(summary.remainingDue) : formatCurrency(0)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-black/90">Status</div>
                  {summary?.hasPendingPayment ? (
                    <Badge variant="warning">Pending Approval</Badge>
                  ) : summary?.belowNisab === true ? (
                    <Badge variant="warning">Below Nisab</Badge>
                  ) : summary?.remainingDue && Number(summary.remainingDue) <= 0 ? (
                    <Badge variant="secondary">Fulfilled This Cycle</Badge>
                  ) : summary?.zakatDue === true ? (
                    <Badge variant="success">Zakat Due</Badge>
                  ) : (
                    <Badge variant="secondary">Select account</Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <FadeModal
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          if (!open) resetPayForm();
        }}
        title="Pay Zakat"
        className="sm:max-w-[560px]"
        saveLabel={paying ? "Processing..." : "Submit Payment"}
        onSave={submitPayment}
        saveLoading={paying}
        saveDisabled={!canSubmit}
      >
        <div className="space-y-4">
          {payBlockReason ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{payBlockReason}</div>
          ) : (
            <div className="rounded-md border border-[#065F46]/20 bg-[#065F46]/5 px-3 py-2 text-xs text-[#065F46]">
              Payment is limited to your remaining Zakat due for this cycle.
            </div>
          )}

          <FormField
            label="Amount to Pay"
            hint={
              payBlockReason ? null : (
              <span className="flex items-center justify-between gap-2">
                <span>
                  Max allowed this cycle:{" "}
                  <span className="font-semibold text-black">{formatCurrency(summary?.remainingDue ?? 0)}</span>
                </span>
                {remainingDueNumber > 0 ? (
                  <button
                    type="button"
                    className="font-semibold text-[#065F46] hover:underline"
                    onClick={() => setAmountInput(formatCurrency(remainingDueNumber))}
                  >
                    Use Remaining Due
                  </button>
                ) : null}
              </span>
              )
            }
          >
            <Input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyInput(amountInput);
                if (parsed > 0) setAmountInput(formatCurrency(parsed));
              }}
              type="text"
              inputMode="decimal"
              placeholder={remainingDueNumber > 0 ? formatCurrency(remainingDueNumber) : "$0.00"}
              disabled={!!payBlockReason}
              className="border-[#b5cec4] bg-white text-black placeholder:text-black/45 disabled:opacity-60"
            />
            {amountError ? <p className="text-xs text-red-600">{amountError}</p> : null}
          </FormField>

          <FormField label="Account (Bank name)">
            <FormSelect value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}>
              {(accountMe?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.balance)})
                </option>
              ))}
            </FormSelect>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Zakat Type">
              <FormSelect value={zakatType} onChange={(e) => setZakatType(e.target.value as "MAAL" | "BUSINESS")}>
                <option value="MAAL">Maal</option>
                <option value="BUSINESS">Business</option>
              </FormSelect>
            </FormField>

            <FormField label="Payment Method">
              <FormSelect
                value={method}
                onChange={(e) => setMethod(e.target.value as "EVCPLUS" | "ZAAD" | "E_DAHAB" | "CASH" | "WALLET")}
              >
                <option value="EVCPLUS">EVCPLUS</option>
                <option value="ZAAD">ZAAD</option>
                <option value="E_DAHAB">E-DAHAB</option>
                <option value="CASH">CASH</option>
                <option value="WALLET">WALLET</option>
              </FormSelect>
            </FormField>
          </div>
        </div>
      </FadeModal>

      <Card className="overflow-hidden border-[#065F46]/20 bg-gradient-to-br from-[#065F46]/5 via-white to-[#D4AF37]/10">
        <div className="h-1 w-full bg-gradient-to-r from-[#065F46] via-[#0E9F6E] to-[#D4AF37]" />
        <CardHeader className="pb-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#065F46]/80">Xog Muhiim Ah</div>
          <CardTitle className="text-xl text-[#065F46]">Fahamka Sannadka Zakat (Hijri)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm text-black/80">
          <p className="rounded-md border border-[#065F46]/20 bg-white/80 px-3 py-2 leading-relaxed">
            <span className="font-semibold text-[#065F46]">Bismillah.</span> Zakat-ka Maal waxaa lagu xisaabiyaa
            <span className="font-semibold"> sannadka dayaxa (Hijri)</span>, ma ahan sannadka caadiga ah (Gregorian).
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border border-[#065F46]/15 bg-white/90 p-3">
              <div className="font-semibold text-[#065F46]">1) Nisab gaadhid</div>
              <p className="mt-1 text-sm text-black/75">
                Marka hantidaadu gaadho qiimaha Nisab (85g dahab), taariikhdaas ayaa noqonaysa bilowga xisaabta.
              </p>
            </div>
            <div className="rounded-md border border-[#065F46]/15 bg-white/90 p-3">
              <div className="font-semibold text-[#065F46]">2) Hal Hijri sano</div>
              <p className="mt-1 text-sm text-black/75">
                Haddii lacagtu Nisab ka hooseynin inta lagu jiro 12 bilood Hijri, Zakat waa waajib marka sannadku dhamaado.
              </p>
            </div>
            <div className="rounded-md border border-[#065F46]/15 bg-white/90 p-3">
              <div className="font-semibold text-[#065F46]">3) Heerka Zakat</div>
              <p className="mt-1 text-sm text-black/75">
                Heerku waa <span className="font-semibold">1/40 (2.5%)</span> hantida Zakat-ka ku waajibta.
              </p>
            </div>
            <div className="rounded-md border border-[#065F46]/15 bg-white/90 p-3">
              <div className="font-semibold text-[#065F46]">4) Bixinta app-ka</div>
              <p className="mt-1 text-sm text-black/75">
                App-ku wuxuu kuu oggolaanayaa kaliya qadarka kuu haray sanadkan si aad uga fogaato bixinta ka badan.
              </p>
            </div>
          </div>
          <p className="text-xs text-black/65">
            Talo: Haddii aad shakido taariikhda Hijri ama xisaabta Nisab, la tasho culimo ama xisaabiye Islaami ah.
          </p>
        </CardContent>
      </Card>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          {receipt ? (
            <>
              <DialogHeader>
                <DialogTitle>Payment Submitted (Pending Approval)</DialogTitle>
                <DialogDescription>Admin will review and finalize your zakat payment.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3 text-sm text-[#1a2332]">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">User</div>
                  <div className="font-medium text-[#1a2332]">{receipt.user?.name ?? "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">Payment ID</div>
                  <div className="font-medium text-[#1a2332]">{receipt.paymentId}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">Zakat Amount</div>
                  <div className="font-medium text-[#1a2332]">{formatCurrency(receipt.amount)}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">Zakat Type</div>
                  <div className="font-medium text-[#1a2332]">{receipt.zakatType}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">Date</div>
                  <div className="font-medium text-[#1a2332]">{new Date(receipt.date).toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-black/80">Nisab Value</div>
                  <div className="font-medium text-[#1a2332]">{formatCurrency(receipt.nisabValue)}</div>
                </div>
              </div>
              <div className="mt-5">
                <Button onClick={() => setReceiptOpen(false)} className="w-full">
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
