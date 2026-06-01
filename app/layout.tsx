import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "OZMS",
    template: "%s | OZMS",
  },
  description: "Online Zakat Management System — trusted, transparent zakat administration.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full overflow-x-hidden antialiased"
      suppressHydrationWarning
    >
      <body
        className={`${poppins.className} flex h-dvh min-w-0 flex-col overflow-hidden`}
        suppressHydrationWarning
      >
        <Providers>
          <AuthSessionBoundary>
            <AppShell>{children}</AppShell>
          </AuthSessionBoundary>
        </Providers>
      </body>
    </html>
  );
}
