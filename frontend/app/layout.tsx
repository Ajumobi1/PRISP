import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISP Portal",
  description: "Unit Tracker and Leadership Dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
