"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { registerSchema } from "@/lib/validation";
import { formatZodFieldErrors, toastFetchError, toastZodError } from "@/lib/client-errors";

export default function RegisterPage() {
  const router = useRouter();
  const countries = React.useMemo(() => {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    const list: string[] = [];
    for (let i = 65; i <= 90; i++) {
      for (let j = 65; j <= 90; j++) {
        const code = String.fromCharCode(i, j);
        const name = displayNames.of(code);
        if (!name || name === code) continue;
        list.push(name);
      }
    }
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, []);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState<"" | "MALE" | "FEMALE">("");
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [countryOpen, setCountryOpen] = React.useState(false);
  const countryWrapRef = React.useRef<HTMLDivElement | null>(null);

  const filteredCountries = React.useMemo(() => {
    const q = country.trim().toLowerCase();
    if (!q) return countries.slice(0, 12);
    return countries.filter((c) => c.toLowerCase().includes(q)).slice(0, 12);
  }, [countries, country]);

  React.useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!countryWrapRef.current) return;
      if (!countryWrapRef.current.contains(e.target as Node)) setCountryOpen(false);
    }
    window.addEventListener("mousedown", onOutside);
    return () => window.removeEventListener("mousedown", onOutside);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      phone,
      age: age || undefined,
      gender: gender || undefined,
      country,
      city,
      address,
    });
    if (!parsed.success) {
      const nextErrors = formatZodFieldErrors(parsed.error);
      setErrors(nextErrors);
      toastZodError(parsed.error);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const apiFieldErrors = (json.fieldErrors ?? {}) as Record<string, string>;
        if (Object.keys(apiFieldErrors).length > 0) {
          setErrors(apiFieldErrors);
          toastFetchError(json);
          return;
        }
        toastFetchError(json, "Registration failed. Please check your details.");
        return;
      }

      toast.success("Account created successfully");
      router.push("/donor");
    } catch {
      toast.error("Registration failed. Please check your connection and try again.");
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
              <span className="text-lg font-semibold">Online Zakat Management System</span>
            </div>
            <h1 className="max-w-sm text-left text-5xl font-semibold leading-[1.1] tracking-[-0.02em]">
              Begin Your Journey of
              <br />
              Purified Wealth.
            </h1>
            <p className="mt-6 max-w-sm text-sm text-white/85">
              Online zakat payment management system. A secure, transparent portal for your spiritual and financial
              obligations.
            </p>
            <div className="mt-48 w-fit rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs backdrop-blur">
              <div className="font-semibold text-[#f2d680]">Trusted by thousands</div>
              <div className="mt-1 text-white/80">Calculated according to Sharia principles</div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center bg-[#f7f8f9] p-6 md:p-10 lg:w-1/2">
          <div className="mx-auto w-full max-w-[560px] rounded-[24px] border border-[#c8d3df] bg-white px-7 py-8 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:px-8">
            <div className="mb-6">
              <div className="text-3xl font-semibold text-black/90">Create Account</div>
              <div className="mt-2 text-sm text-black/60">Join to manage your zakat with precision and peace.</div>
            </div>

            <div className="mb-5 flex items-center justify-between rounded-lg border border-black/5 bg-[#efefef] px-4 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-black/80">
                <UserRound className="h-4 w-4 text-[#065F46]" />
                Registering as Donor
              </div>
              <span className="rounded bg-[#f2e9c4] px-2 py-1 text-[10px] font-semibold tracking-wide text-[#816b1b]">
                PUBLIC ACCESS
              </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">First Name</div>
                  <Input value={firstName} onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrors((prev) => ({ ...prev, firstName: "" }));
                  }} placeholder="First Name" />
                  {errors.firstName ? <div className="text-xs text-red-600">{errors.firstName}</div> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Last Name</div>
                  <Input value={lastName} onChange={(e) => {
                    setLastName(e.target.value);
                    setErrors((prev) => ({ ...prev, lastName: "" }));
                  }} placeholder="Last Name" />
                  {errors.lastName ? <div className="text-xs text-red-600">{errors.lastName}</div> : null}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Email Address</div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                  <Input
                    className="pl-9"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="off"
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
                      setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Phone (optional)</div>
                  <Input className="bg-white text-black" value={phone} onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((prev) => ({ ...prev, phone: "" }));
                  }} placeholder="Phone" autoComplete="off" />
                  {errors.phone ? <div className="text-xs text-red-600">{errors.phone}</div> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Age</div>
                  <Input className="bg-white text-black" type="number" value={age} onChange={(e) => {
                    setAge(e.target.value);
                    setErrors((prev) => ({ ...prev, age: "" }));
                  }} placeholder="Age" autoComplete="off" />
                  {errors.age ? <div className="text-xs text-red-600">{errors.age}</div> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Gender</div>
                  <select
                    className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                    value={gender}
                    onChange={(e) => {
                      setGender((e.target.value as "MALE" | "FEMALE" | "") ?? "");
                      setErrors((prev) => ({ ...prev, gender: "" }));
                    }}
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                  {errors.gender ? <div className="text-xs text-red-600">{errors.gender}</div> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Country</div>
                  <div className="relative" ref={countryWrapRef}>
                    <Input
                      className="bg-white text-black"
                      value={country}
                      onFocus={() => setCountryOpen(true)}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setCountryOpen(true);
                        setErrors((prev) => ({ ...prev, country: "" }));
                      }}
                      placeholder="Search country..."
                      autoComplete="off"
                    />
                    {countryOpen ? (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-black/10 bg-white shadow-md">
                        {filteredCountries.length ? (
                          filteredCountries.map((countryName) => (
                            <button
                              key={countryName}
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-black hover:bg-black/5"
                              onClick={() => {
                                setCountry(countryName);
                                setCountryOpen(false);
                              }}
                            >
                              {countryName}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-black/60">No country found</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {errors.country ? <div className="text-xs text-red-600">{errors.country}</div> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">City</div>
                  <Input className="bg-white text-black" value={city} onChange={(e) => {
                    setCity(e.target.value);
                    setErrors((prev) => ({ ...prev, city: "" }));
                  }} placeholder="City" autoComplete="off" />
                  {errors.city ? <div className="text-xs text-red-600">{errors.city}</div> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/70">Address</div>
                  <Input className="bg-white text-black" value={address} onChange={(e) => {
                    setAddress(e.target.value);
                    setErrors((prev) => ({ ...prev, address: "" }));
                  }} placeholder="Address" autoComplete="off" />
                  {errors.address ? <div className="text-xs text-red-600">{errors.address}</div> : null}
                </div>
              </div>

              <Button
                className="mt-2 h-11 w-full rounded-full bg-gradient-to-r from-[#065F46] to-[#2d6f2e] text-base font-semibold shadow-[0_10px_24px_rgba(6,95,70,0.22)] hover:opacity-95"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="pt-1 text-center text-xs text-black/60">
                Already have an account?{" "}
                <Link className="font-semibold text-[#065F46]" href="/login">
                  Log in here
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

