"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FadeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  /** Built-in footer — shown when onSave or footer is provided */
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
  saveVariant?: "default" | "destructive";
  hideFooter?: boolean;
  footer?: React.ReactNode;
};

export function FadeModal({
  open,
  onOpenChange,
  title,
  icon,
  children,
  className,
  titleClassName,
  bodyClassName,
  onSave,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saveDisabled,
  saveLoading,
  saveVariant = "default",
  hideFooter,
  footer,
}: FadeModalProps) {
  const showFooter = !hideFooter && (footer != null || onSave != null);

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border border-[#d5dce6] p-0 shadow-xl sm:max-w-[520px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
      >
        <DialogHeader className="space-y-0 border-b border-[#d5dce6] bg-[#eef1f5] px-5 py-4">
          <DialogTitle className={cn("flex items-center gap-2 pr-8 text-base font-semibold text-[#1a2332]", titleClassName)}>
            {icon}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{title} dialog</DialogDescription>
        </DialogHeader>

        <div className={cn("bg-white px-5 py-5", bodyClassName)}>{children}</div>

        {showFooter ? (
          <div className="flex items-center justify-end gap-2 border-t border-[#d5dce6] bg-[#eef1f5] px-5 py-3.5">
            {footer ?? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={saveLoading}>
                  {cancelLabel}
                </Button>
                <Button
                  variant={saveVariant === "destructive" ? "destructive" : "default"}
                  onClick={onSave}
                  disabled={saveDisabled || saveLoading}
                >
                  {saveLoading ? "Saving..." : saveLabel}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
