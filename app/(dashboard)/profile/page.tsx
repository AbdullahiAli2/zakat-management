import { Suspense } from "react";
import { ProfilePage } from "@/components/profile-page";

export default function DashboardProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-black/60">Loading profile...</div>}>
      <ProfilePage />
    </Suspense>
  );
}

