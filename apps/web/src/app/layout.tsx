import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PumpNow — Launch on Arc",
  description: "Create, discover and trade community tokens on Arc.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
