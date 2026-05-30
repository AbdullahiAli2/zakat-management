"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loginSchema } from "@/lib/validation";
import { formatZodFieldErrors, toastFetchError, toastZodError } from "@/lib/client-errors";
import { completeLoginSession, homePathForRole } from "@/lib/auth-client";
import { ArrowRight, BadgeCheck, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors = formatZodFieldErrors(parsed.error);
      setErrors({
        email: nextErrors.email,
        password: nextErrors.password,
      });
      toastZodError(parsed.error);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toastFetchError(json, "Login failed. Please check your email and password.");
        return;
      }

      const role = json?.user?.role as string;
      toast.success("Welcome back");
      await completeLoginSession();
      router.replace(homePathForRole(role));
      router.refresh();
    } catch {
      toast.error("Login failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#eef1f4]">
      <div className="flex min-h-0 flex-1 w-full overflow-hidden bg-white">
        <div className="hidden w-1/2 bg-gradient-to-br from-[#064e3b] via-[#065F46] to-[#0b5a3f] p-8 text-white lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-md">
            <div className="mb-14 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-[#f2d680]" />
              <span className="text-lg font-semibold">Zakat Management System</span>
            </div>
            <h1 className="max-w-xs text-4xl font-semibold leading-tight">Welcome Back to Your Zakat Portal.</h1>
            <p className="mt-6 max-w-sm text-sm text-white/85">
              Continue your secure and transparent zakat management journey with confidence.
            </p>
            <div className="mt-48 w-fit rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs backdrop-blur">
              <div className="font-semibold text-[#f2d680]">Trusted by thousands</div>
              <div className="mt-1 text-white/80">Protection, compliance, and transparency</div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center bg-[#f7f8f9] p-6 md:p-10 lg:w-1/2">
          <div className="mx-auto w-full max-w-[560px] rounded-[24px] border border-[#c8d3df] bg-white px-7 py-8 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:px-8">
            <div className="mb-6">
              <div className="text-3xl font-semibold text-black/90">Sign In</div>
              <div className="mt-2 text-sm text-black/60">Access your account dashboard securely.</div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Email Address</div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                  <Input
                    className="pl-9"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    type="email"
                    placeholder="name@example.com"
                  />
                </div>
                {errors.email ? <div className="text-xs text-red-600">{errors.email}</div> : null}
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Password</div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                  <Input
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/55 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <div className="text-xs text-red-600">{errors.password}</div> : null}
              </div>

              <Button
                className="mt-2 h-11 w-full rounded-full bg-gradient-to-r from-[#065F46] to-[#2d6f2e] text-base font-semibold shadow-[0_10px_24px_rgba(6,95,70,0.22)] hover:opacity-95"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Login"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="pt-1 text-center text-xs text-black/60">
                Donor and new here?{" "}
                <Link className="font-semibold text-[#065F46]" href="/register">
                  Create account
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

