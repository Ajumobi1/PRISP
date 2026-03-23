import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRS Unit Task Tracker",
  description: "Unit Task Tracker",
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
