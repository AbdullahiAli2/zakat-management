"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { toast } from "sonner";
import { Info, KeyRound } from "lucide-react";
import { toastFetchError } from "@/lib/client-errors";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 rounded-lg border-[#c5d9d2] bg-white text-black placeholder:text-black/40 focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15";

type ChangePasswordModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
  }

  React.useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const canSubmit = currentPassword.trim().length > 0 && newPassword.length >= 8;

  async function handleSubmit() {
    if (!currentPassword.trim()) {
      toast.error("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok || !json.ok) {
        toastFetchError(json, "Failed to change password");
        return;
      }
      resetForm();
      onOpenChange(false);
      toast.success("Password changed successfully");
    } catch {
      toast.error("Failed to change password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border border-[#dce5e1] p-0 shadow-2xl max-w-[min(30rem,calc(100%-2rem))]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "[&>button]:top-4 [&>button]:right-4 [&>button]:text-[#64748b] [&>button]:hover:bg-[#f1f5f3] [&>button]:hover:text-[#1e293b]",
        )}
      >
        <DialogHeader className="space-y-0 border-b border-[#e8eeeb] bg-white px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-3 pr-8 text-lg font-semibold text-[#1a2332]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#065F46]/10">
              <KeyRound className="h-[18px] w-[18px] text-[#065F46]" />
            </span>
            Change Password
          </DialogTitle>
          <DialogDescription className="sr-only">Update your account password</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 bg-white px-6 py-5">
          <div className="flex gap-2.5 rounded-lg border border-[#d4ebe3] bg-[#f0f9f6] px-3.5 py-3 text-xs leading-relaxed text-[#475569]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden />
            <p>Use at least 8 characters. Choose a password you do not use elsewhere.</p>
          </div>

          <FormField label="Current Password">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className={inputClass}
            />
          </FormField>

          <FormField label="New Password">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#e8eeeb] bg-[#fafbfa] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="min-w-[100px] border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f9fafb]"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-w-[140px] bg-[#065F46] text-white hover:bg-[#054e3a]"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || saving}
          >
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
