import type { Metadata } from "next";
import "./globals.css";
import "./designer.css";

export const metadata: Metadata = {
  title: "KSM Timber Pavilion Designer",
  description: "Design a KSM timber pavilion. Explore truss styles, sizes, timber finishes, and roofing in 3D.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/ksm-symbol.png",
    shortcut: "/brand/ksm-symbol.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
