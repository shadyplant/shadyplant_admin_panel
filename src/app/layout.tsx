import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
import { isSiteUnderMaintenance } from "@/lib/admin-api";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShadyPlant Admin Panel",
  description: "Management workspace for ShadyPlant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const maintenanceMode = isSiteUnderMaintenance();
  const maintenanceMessage =
    process.env.NEXT_PUBLIC_SITE_MAINTENANCE_MESSAGE?.trim() ||
    "ShadyPlant Admin is currently under maintenance.";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#ffffff] text-[var(--admin-ink)] flex flex-col">
        {maintenanceMode ? (
          <div className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
            {maintenanceMessage}
          </div>
        ) : null}
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
