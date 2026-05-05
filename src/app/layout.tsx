import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
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
  title: "GGN Admin Panel",
  description: "Management workspace for Grass Green Nursery commerce operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
