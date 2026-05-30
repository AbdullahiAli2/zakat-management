"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useGetAccountsMeQuery, useGetSystemWalletQuery, useGetTransactionsQuery } from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { toast } from "sonner";
import { CalendarDays, KeyRound } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { toastFetchError } from "@/lib/client-errors";

type ProfileResponse = {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  age: number | null;
  gender: "MALE" | "FEMALE" | null;
  country: string | null;
  city: string | null;
  address: string | null;
  createdAt: string;
};

export function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: accountMe } = useGetAccountsMeQuery();
  const { data: txSummary } = useGetTransactionsQuery({ page: 1, pageSize: 5 });
  const [loading, setLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState<"MALE" | "FEMALE" | "">("");
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  function openPasswordModal() {
    setPasswordOpen(true);
  }

  React.useEffect(() => {
    if (searchParams.get("changePassword") === "1") {
      openPasswordModal();
      router.replace("/profile", { scroll: false });
    }
  }, [searchParams, router]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      const json = (await res.json()) as { ok: boolean; data?: ProfileResponse; error?: string };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load profile");
      setProfile(json.data);
      setFirstName(json.data.firstName ?? "");
      setLastName(json.data.lastName ?? "");
      setPhone(json.data.phone ?? "");
      setAge(json.data.age ? String(json.data.age) : "");
      setGender(json.data.gender ?? "");
      setCountry(json.data.country ?? "");
      setCity(json.data.city ?? "");
      setAddress(json.data.address ?? "");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadProfile();
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          age: age ? Number(age) : undefined,
          gender: gender || undefined,
          country,
          city,
          address,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: Record<string, string>; data?: ProfileResponse };
      if (!res.ok || !json.ok) {
        toastFetchError(json, "Failed to update profile");
        return;
      }
      if (json.data) {
        setProfile(json.data);
      }
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: { avatarUrl: string } };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to upload image");
      setProfile((prev) => (prev ? { ...prev, avatarUrl: json.data?.avatarUrl ?? prev.avatarUrl } : prev));
      toast.success("Profile image updated");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to upload image");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  const roleTone =
    profile?.role === "SUPERUSER"
      ? "bg-[#F4D35E] text-[#5E4B00]"
      : profile?.role === "ADMIN"
        ? "bg-[#DCFCE7] text-[#166534]"
        : "bg-[#E0E7FF] text-[#3730A3]";
  const isSystemRole = profile?.role === "SUPERUSER" || profile?.role === "ADMIN";
  const { data: systemWallet } = useGetSystemWalletQuery(undefined, { skip: !isSystemRole });

  const recentItems = txSummary?.items ?? [];
  const actionsProcessed = txSummary?.total ?? 0;
  const walletTitle = isSystemRole ? "System Wallet" : "Wallet Balance";
  const walletValue = isSystemRole ? (systemWallet?.balance ?? 0) : (accountMe?.balance ?? 0);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-black/80">Loading profile...</CardContent>
        </Card>
      ) : (
        <>
          <Card className="border border-black/10">
            <CardContent className="pt-6 text-black">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-black/10 bg-black/5 sm:h-20 sm:w-20">
                    {profile?.avatarUrl ? (
                      <Image src={profile.avatarUrl} alt="Profile" width={80} height={80} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#065F46]">
                        {profile?.firstName?.slice(0, 1).toUpperCase() ?? "U"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-2xl font-bold text-black">{profile?.name ?? "-"}</h1>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${roleTone}`}>{profile?.role ?? "USER"}</span>
                    </div>
                    <div className="mt-1 text-sm text-black/65">
                      Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "-"} · ID: #{profile?.id ?? "-"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-black/10 px-3 py-2 text-sm hover:bg-black/[0.03]">
                    Upload Photo
                    <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} />
                  </label>
                  <Button type="button" variant="outline" onClick={openPasswordModal}>
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </Button>
                  <Button className="bg-[#065F46] text-white hover:bg-[#054e3a]" onClick={onSaveProfile} disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
              {uploadingAvatar ? <div className="mt-2 text-xs text-black/70">Uploading image...</div> : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-black/45">{walletTitle}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-[#065F46]">{formatCurrency(walletValue)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-black/45">Actions Processed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-black">{actionsProcessed.toLocaleString()}</div>
                <div className="mt-1 text-xs text-black/60">From your transaction history</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-black">
                <form
                  onSubmit={onSaveProfile}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">First Name</div>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Last Name</div>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Email Address</div>
                    <Input value={profile?.email ?? ""} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Phone Number</div>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Age</div>
                    <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Gender</div>
                    <select
                      className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "")}
                    >
                      <option value="">Select gender</option>
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">Country</div>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase text-black/50">City</div>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-black/50">Address</div>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="pt-2 sm:col-span-2">
                    <Button type="submit" className="bg-[#065F46] text-white hover:bg-[#054e3a]" disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <span className="text-[11px] font-semibold text-[#065F46]">VIEW ALL</span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {recentItems.length ? recentItems.map((item) => (
                    <div key={item.id} className="flex gap-2 text-sm">
                      <div className="mt-1 h-2 w-2 rounded-full bg-[#10B981]" />
                      <div>
                        <div className="font-semibold text-black">{item.type.replaceAll("_", " ")}</div>
                        <div className="text-xs text-black/60">
                          {formatCurrency(item.amount)} · {new Date(item.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-black/60">No recent activity yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-black/75">
              <div className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Member Since: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "-"}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

